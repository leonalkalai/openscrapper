"use server" // Αυτή η οδηγία δηλώνει ότι αυτό το αρχείο θα εκτελεστεί μόνο στον server

import OpenCarScraper from "../opencar-scraper.js" // Εισαγωγή του scraper

interface ApplicationData {
  success: boolean
  licensePlate: string // Προσθήκη πινακίδας στα δεδομένα
  data?: Record<string, string>
  error?: string
  timestamp: string
}

interface ScrapingResult {
  applicationData: ApplicationData[] // Τώρα είναι array από αποτελέσματα
  logs: string[]
}

export async function scrapeApplicationAction(
  licensePlates: string[], // Νέα παράμετρος: array από πινακίδες
  delayBetweenRequests: number,
  maxRetries: number,
): Promise<ScrapingResult> {
  const logs: string[] = []
  const allApplicationData: ApplicationData[] = [] // Συγκέντρωση όλων των αποτελεσμάτων

  const addLog = (message: string, type: "info" | "success" | "error" | "warning" = "info") => {
    const timestamp = new Date().toLocaleTimeString("el-GR")
    logs.push(`[${timestamp}] ${type.toUpperCase()}: ${message}`)
  }

  let browserInstance = null // Θα χρησιμοποιήσουμε μία μόνο browser instance για όλες τις πινακίδες

  try {
    addLog("Αρχικοποίηση scraper...", "info")
    // Αρχικοποίηση του browser μία φορά
    const tempScraper = new OpenCarScraper("temp") // Χρησιμοποιούμε μια προσωρινή πινακίδα για την αρχικοποίηση
    await tempScraper.init()
    browserInstance = tempScraper.browser // Κρατάμε την browser instance

    for (const licensePlate of licensePlates) {
      addLog(`Έναρξη scraping για την πινακίδα: ${licensePlate}`, "info")
      const scraper = new OpenCarScraper(licensePlate) // Δημιουργία νέου scraper για κάθε πινακίδα
      scraper.requestDelay = delayBetweenRequests * 1000
      scraper.maxRetries = maxRetries
      scraper.browser = browserInstance // Χρησιμοποιούμε την υπάρχουσα browser instance
      scraper.page = await browserInstance.newPage() // Δημιουργία νέας σελίδας για κάθε πινακίδα

      let currentApplicationData: ApplicationData

      try {
        const result = await scraper.scrapeApplication()

        if (result) {
          addLog(`Επιτυχής scraping για την πινακίδα: ${licensePlate}`, "success")
          currentApplicationData = {
            success: true,
            licensePlate: licensePlate,
            data: result.extractedData,
            timestamp: new Date().toISOString(),
          }
        } else {
          addLog(`Αποτυχία scraping για την πινακίδα: ${licensePlate}`, "error")
          currentApplicationData = {
            success: false,
            licensePlate: licensePlate,
            error: "Δεν ήταν δυνατή η εξαγωγή δεδομένων από τη σελίδα",
            timestamp: new Date().toISOString(),
          }
        }
      } catch (error: any) {
        addLog(`Σφάλμα κατά το scraping της πινακίδας ${licensePlate}: ${error.message}`, "error")
        currentApplicationData = {
          success: false,
          licensePlate: licensePlate,
          error: error.message,
          timestamp: new Date().toISOString(),
        }
      } finally {
        if (scraper.page) {
          await scraper.page.close() // Κλείνουμε τη σελίδα μετά από κάθε scraping
        }
      }
      allApplicationData.push(currentApplicationData)
      await scraper.delay(delayBetweenRequests * 1000) // Καθυστέρηση μεταξύ αιτημάτων
    }
  } catch (error: any) {
    addLog(`Γενικό σφάλμα κατά την εκτέλεση του scraper: ${error.message}`, "error")
  } finally {
    if (browserInstance) {
      await browserInstance.close() // Κλείνουμε τον browser στο τέλος
      addLog("Browser κλείσιμο", "info")
    }
  }

  return { applicationData: allApplicationData, logs }
}
