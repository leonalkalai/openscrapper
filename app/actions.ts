"use server" // Αυτή η οδηγία δηλώνει ότι αυτό το αρχείο θα εκτελεστεί μόνο στον server

import OpenCarScraper from "../opencar-scraper.js" // Εισαγωγή του scraper

interface ApplicationData {
  success: boolean
  data?: Record<string, string>
  error?: string
  timestamp: string
}

interface ScrapingResult {
  applicationData: ApplicationData | null
  logs: string[]
}

export async function scrapeApplicationAction(
  targetUrl: string, // Νέα παράμετρος: η URL που θα γίνει scrape
  delayBetweenRequests: number,
  maxRetries: number,
): Promise<ScrapingResult> {
  const logs: string[] = []
  const addLog = (message: string, type: "info" | "success" | "error" | "warning" = "info") => {
    const timestamp = new Date().toLocaleTimeString("el-GR")
    logs.push(`[${timestamp}] ${type.toUpperCase()}: ${message}`)
  }

  const scraper = new OpenCarScraper(targetUrl) // Περάστε τη URL στον constructor
  scraper.requestDelay = delayBetweenRequests * 1000 // Μετατροπή δευτερολέπτων σε χιλιοστά του δευτερολέπτου
  scraper.maxRetries = maxRetries

  let applicationData: ApplicationData | null = null

  try {
    addLog("Αρχικοποίηση scraper για την εφαρμογή...", "info")
    await scraper.init()

    addLog(`Έναρξη scraping της σελίδας εφαρμογής: ${targetUrl}`, "info")
    const result = await scraper.scrapeApplication() // Κλήση της μεθόδου scraping

    if (result) {
      addLog("Επιτυχής scraping της σελίδας εφαρμογής", "success")
      applicationData = {
        success: true,
        data: result.extractedData,
        timestamp: new Date().toISOString(),
      }
    } else {
      addLog("Αποτυχία scraping της σελίδας εφαρμογής", "error")
      applicationData = {
        success: false,
        error: "Δεν ήταν δυνατή η εξαγωγή δεδομένων από τη σελίδα εφαρμογής",
        timestamp: new Date().toISOString(),
      }
    }
  } catch (error: any) {
    addLog(`Σφάλμα κατά το scraping της εφαρμογής: ${error.message}`, "error")
    applicationData = {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    }
  } finally {
    await scraper.close()
  }

  return { applicationData, logs }
}
