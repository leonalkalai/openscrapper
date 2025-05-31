import "server-only" // Αυτή η οδηγία διασφαλίζει ότι αυτό το αρχείο θα συμπεριληφθεί μόνο σε server-side builds
import puppeteer from "puppeteer-core" // Χρησιμοποιούμε puppeteer-core
import chromium from "@sparticuz/chromium" // Εισάγουμε το @sparticuz/chromium
import fs from "fs/promises"
import path from "path"

class OpenCarScraper {
  constructor(baseUrl) {
    // Δέχεται τη baseUrl ως παράμετρο
    this.baseUrl = baseUrl // Χρησιμοποιεί τη URL που παρέχεται
    this.requestDelay = 60000 // 1 αίτημα ανά λεπτό (used for retries)
    this.maxRetries = 3
    this.browser = null
    this.page = null
    this.userAgent =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  }

  async init() {
    console.log("🚀 Αρχικοποίηση OpenCar Scraper...")

    // Καθορίζουμε τη λειτουργία headless ανάλογα με το περιβάλλον
    // Στο Vercel (production), θα είναι headless. Τοπικά, θα είναι ορατό για χειροκίνητο CAPTCHA.
    const isProduction = process.env.VERCEL_ENV === "production"
    const headlessMode = isProduction ? chromium.headless : false

    this.browser = await puppeteer.launch({
      args: [...chromium.args, "--hide-scrollbars", "--disable-web-security"], // Προσθέτουμε τα απαραίτητα args για serverless
      executablePath: await chromium.executablePath(), // Χρησιμοποιούμε το executable path από το @sparticuz/chromium
      headless: headlessMode, // Χρησιμοποιούμε την καθορισμένη λειτουργία headless
      ignoreHTTPSErrors: true, // Συχνά χρήσιμο για scraping
      slowMo: isProduction ? 0 : 100, // Χωρίς slowMo σε production
    })

    this.page = await this.browser.newPage()

    // Ρύθμιση User Agent και viewport
    await this.page.setUserAgent(this.userAgent)
    await this.page.setViewport({ width: 1366, height: 768 })

    // Αποκρύπτουμε ότι είναι automated browser
    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      })
    })

    console.log("✅ Scraper αρχικοποιήθηκε επιτυχώς")
  }

  async delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  async detectCaptcha() {
    try {
      // Ελέγχουμε για διάφορους τύπους captcha
      const captchaSelectors = [
        'iframe[src*="recaptcha"]',
        ".g-recaptcha",
        "#captcha",
        ".captcha",
        'img[alt*="captcha"]',
        'img[src*="captcha"]',
      ]

      for (const selector of captchaSelectors) {
        const element = await this.page.$(selector)
        if (element) {
          console.log(`🔍 Εντοπίστηκε captcha: ${selector}`)
          return true
        }
      }
      return false
    } catch (error) {
      console.log("⚠️ Σφάλμα κατά τον έλεγχο captcha:", error.message)
      return false
    }
  }

  async handleCaptcha() {
    console.log("🤖 Χειρισμός captcha...")

    const hasCaptcha = await this.detectCaptcha()
    if (!hasCaptcha) {
      return true
    }

    // Εάν εκτελείται σε περιβάλλον Vercel (headless), η χειροκίνητη επίλυση δεν είναι δυνατή.
    if (process.env.VERCEL_ENV === "production") {
      console.log("❌ Captcha εντοπίστηκε σε περιβάλλον Vercel. Η χειροκίνητη επίλυση δεν είναι δυνατή.")
      throw new Error("Captcha detected. Manual solving not possible in serverless environment.")
    }

    // Για τοπική ανάπτυξη (headless: false), περιμένουμε για χειροκίνητη λύση
    console.log("⏳ Παρακαλώ λύστε το captcha χειροκίνητα στο παράθυρο του browser...")
    console.log("   Το script θα περιμένει μέχρι 60 δευτερόλεπτα")

    let attempts = 0
    const maxWaitTime = 60 // 60 δευτερόλεπτα

    while (attempts < maxWaitTime) {
      await this.delay(1000)
      attempts++

      const stillHasCaptcha = await this.detectCaptcha()
      if (!stillHasCaptcha) {
        console.log("✅ Captcha λύθηκε επιτυχώς!")
        return true
      }

      if (attempts % 10 === 0) {
        console.log(`⏱️ Αναμονή... ${maxWaitTime - attempts} δευτερόλεπτα απομένουν`)
      }
    }

    console.log("❌ Timeout στη λύση του captcha")
    return false
  }

  async navigateToTargetPage() {
    console.log(`🌐 Πλοήγηση στη σελίδα: ${this.baseUrl}`)

    try {
      await this.page.goto(this.baseUrl, {
        waitUntil: "networkidle2",
        timeout: 30000,
      })

      console.log("✅ Επιτυχής φόρτωση της σελίδας")

      // Ελέγχουμε για captcha
      const captchaHandled = await this.handleCaptcha()
      if (!captchaHandled) {
        throw new Error("Αποτυχία χειρισμού captcha")
      }

      return true
    } catch (error) {
      console.error("❌ Σφάλμα πλοήγησης:", error.message)
      return false
    }
  }

  async extractVehicleData() {
    console.log("📊 Εξαγωγή δεδομένων οχήματος...")

    try {
      const extractedData = await this.page.evaluate(() => {
        const data = {}

        // Common patterns for key-value pairs on web forms/display pages
        // 1. <label> and sibling input/span/div
        document.querySelectorAll("label").forEach((label) => {
          const key = label.textContent.trim()
          const nextElement = label.nextElementSibling
          if (nextElement && key) {
            if (
              nextElement.tagName === "INPUT" ||
              nextElement.tagName === "TEXTAREA" ||
              nextElement.tagName === "SELECT"
            ) {
              data[key] = nextElement.value.trim()
            } else {
              data[key] = nextElement.textContent.trim()
            }
          }
        })

        // 2. <dt> and <dd> pairs (Definition List)
        document.querySelectorAll("dt").forEach((dt) => {
          const key = dt.textContent.trim()
          const dd = dt.nextElementSibling
          if (dd && dd.tagName === "DD") {
            data[key] = dd.textContent.trim()
          }
        })

        // 3. Divs with specific roles or classes (e.g., form-group, row, field)
        // This is more generic and might need refinement based on actual page structure
        document.querySelectorAll(".form-group, .row, .field, .data-item").forEach((container) => {
          const keyElement = container.querySelector(".label, .key, .col-label, h3, h4, strong")
          const valueElement = container.querySelector(".value, .data, .col-value, p, span")

          if (keyElement && valueElement) {
            const key = keyElement.textContent.trim()
            const value = valueElement.textContent.trim()
            if (key && value && !data[key]) {
              // Avoid overwriting if already found by label
              data[key] = value
            }
          }
        })

        // 4. Table rows (tr) with two cells (th/td for key, td for value)
        document.querySelectorAll("table tr").forEach((row) => {
          const cells = Array.from(row.querySelectorAll("th, td"))
          if (cells.length >= 2) {
            const key = cells[0].textContent.trim()
            const value = cells[1].textContent.trim()
            if (key && value && !data[key]) {
              data[key] = value
            }
          }
        })

        // Clean up empty keys or values that might be artifacts of generic selectors
        for (const key in data) {
          if (Object.prototype.hasOwnProperty.call(data, key)) {
            if (!key || !data[key] || data[key].toLowerCase() === "n/a" || data[key].toLowerCase() === "undefined") {
              delete data[key]
            }
          }
        }

        return {
          extractedData: data,
          timestamp: new Date().toISOString(),
        }
      })

      console.log("✅ Δεδομένα εξήχθησαν επιτυχώς")
      return extractedData
    } catch (error) {
      console.error("❌ Σφάλμα εξαγωγής δεδομένων:", error.message)
      return null
    }
  }

  async saveData(data) {
    try {
      const filename = `opencar_application_data_${Date.now()}.json` // Generic filename
      const filepath = path.join(process.cwd(), "data", filename)

      // Δημιουργούμε τον φάκελο data αν δεν υπάρχει
      await fs.mkdir(path.dirname(filepath), { recursive: true })

      await fs.writeFile(filepath, JSON.stringify(data, null, 2), "utf8")
      console.log(`💾 Δεδομένα αποθηκεύτηκαν: ${filename}`)

      return filepath
    } catch (error) {
      console.error("❌ Σφάλμα αποθήκευσης:", error.message)
      return null
    }
  }

  async scrapeApplication() {
    console.log(`\n🚗 Έναρξη scraping για την εφαρμογή: ${this.baseUrl}`)

    let retries = 0
    while (retries < this.maxRetries) {
      try {
        // Πλοήγηση στη σελίδα
        const navigated = await this.navigateToTargetPage()
        if (!navigated) {
          throw new Error("Αποτυχία πλοήγησης")
        }

        // Εξαγωγή δεδομένων
        const data = await this.extractVehicleData()
        if (!data) {
          throw new Error("Αποτυχία εξαγωγής δεδομένων")
        }

        // Αποθήκευση δεδομένων
        await this.saveData(data)

        console.log(`✅ Επιτυχές scraping για την εφαρμογή`)
        return data
      } catch (error) {
        retries++
        console.error(`❌ Προσπάγεια ${retries}/${this.maxRetries} απέτυχε:`, error.message)

        if (retries < this.maxRetries) {
          console.log(`⏳ Αναμονή ${this.requestDelay / 1000} δευτερολέπτων πριν την επόμενη προσπάθεια...`)
          await this.delay(this.requestDelay)
        }
      }
    }

    console.error(`❌ Αποτυχία scraping για την εφαρμογή μετά από ${this.maxRetries} προσπάθειες`)
    return null
  }

  async close() {
    if (this.browser) {
      await this.browser.close()
      console.log("🔒 Browser κλείσιμο")
    }
  }
}

export default OpenCarScraper // Export the class
