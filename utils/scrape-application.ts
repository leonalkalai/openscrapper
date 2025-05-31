// utils/scrape-application.ts

import OpenCarScraper from "../opencar-scraper.js" // Adjust path if necessary

interface ApplicationData {
  success: boolean
  data?: Record<string, string>
  error?: string
  timestamp: string
}

export const scrapeApplicationPage = async (
  addLog: (message: string, type?: "info" | "success" | "error" | "warning") => void,
): Promise<ApplicationData> => {
  const scraper = new OpenCarScraper()
  try {
    addLog("Αρχικοποίηση scraper για την εφαρμογή...", "info")
    await scraper.init()

    addLog("Έναρξη scraping της σελίδας εφαρμογής...", "info")
    const result = await scraper.scrapeApplication() // Call the new method

    if (result) {
      addLog("Επιτυχής scraping της σελίδας εφαρμογής", "success")
      return {
        success: true,
        data: result.extractedData,
        timestamp: new Date().toISOString(),
      }
    } else {
      addLog("Αποτυχία scraping της σελίδας εφαρμογής", "error")
      return {
        success: false,
        error: "Δεν ήταν δυνατή η εξαγωγή δεδομένων από τη σελίδα εφαρμογής",
        timestamp: new Date().toISOString(),
      }
    }
  } catch (error: any) {
    addLog(`Σφάλμα κατά το scraping της εφαρμογής: ${error.message}`, "error")
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    }
  } finally {
    await scraper.close()
  }
}
