"use client"
import { scrapeApplicationAction } from "@/app/actions" // Import the Server Action

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Download, Play, Square, AlertTriangle, CheckCircle, XCircle } from "lucide-react"

interface ApplicationData {
  success: boolean
  data?: Record<string, string>
  error?: string
  timestamp: string
}

interface ScrapingStatus {
  isRunning: boolean
  results: ApplicationData | null // Now holds a single result or null
  logs: string[]
}

export default function OpenCarScraper() {
  // State declarations
  const [status, setStatus] = useState<ScrapingStatus>({
    isRunning: false,
    results: null,
    logs: [],
  })
  const [settings, setSettings] = useState({
    targetUrl: "https://dilosi.services.gov.gr/issue/487143024/application/", // Προσθήκη state για την URL
    delayBetweenRequests: 60, // δευτερόλεπτα
    maxRetries: 3,
    respectTerms: false,
  })

  // Start scraping
  const startScraping = async () => {
    if (!settings.respectTerms) {
      alert("Πρέπει να συμφωνήσετε με τους όρους χρήσης")
      return
    }
    if (!settings.targetUrl) {
      alert("Παρακαλώ εισάγετε μια URL για scraping.")
      return
    }

    // Reset status for a new scrape
    setStatus((prev) => ({
      ...prev,
      isRunning: true,
      results: null,
      logs: [], // Clear previous logs
    }))

    // Add initial log
    setStatus((prev) => ({
      ...prev,
      logs: [
        ...prev.logs,
        `[${new Date().toLocaleTimeString("el-GR")}] INFO: Έναρξη scraping της σελίδας εφαρμογής...`,
      ],
    }))

    try {
      // Call the Server Action, passing the targetUrl
      const { applicationData, logs: serverLogs } = await scrapeApplicationAction(
        settings.targetUrl, // Περάστε τη URL
        settings.delayBetweenRequests,
        settings.maxRetries,
      )

      setStatus((prev) => ({
        ...prev,
        results: applicationData,
        logs: [...prev.logs, ...serverLogs], // Append logs from the server action
      }))

      if (applicationData?.success) {
        setStatus((prev) => ({
          ...prev,
          logs: [...prev.logs, `[${new Date().toLocaleTimeString("el-GR")}] SUCCESS: Scraping ολοκληρώθηκε επιτυχώς!`],
        }))
      } else {
        setStatus((prev) => ({
          ...prev,
          logs: [
            ...prev.logs,
            `[${new Date().toLocaleTimeString("el-GR")}] ERROR: Scraping απέτυχε: ${applicationData?.error || "Άγνωστο σφάλμα"} `,
          ],
        }))
      }
    } catch (error: any) {
      setStatus((prev) => ({
        ...prev,
        logs: [
          ...prev.logs,
          `[${new Date().toLocaleTimeString("el-GR")}] ERROR: Σφάλμα κατά το scraping: ${error.message}`,
        ],
      }))
    } finally {
      setStatus((prev) => ({
        ...prev,
        isRunning: false,
      }))
    }
  }

  // Stop scraping (less relevant for a single page, but kept for consistency)
  // Note: Aborting a server action from the client is not directly supported in the same way as client-side promises.
  // The server action will run to completion once invoked. This button will primarily update the UI state.
  const stopScraping = () => {
    setStatus((prev) => ({
      ...prev,
      isRunning: false,
      logs: [
        ...prev.logs,
        `[${new Date().toLocaleTimeString("el-GR")}] WARNING: Αίτημα διακοπής scraping (η τρέχουσα λειτουργία στον server θα ολοκληρωθεί).`,
      ],
    }))
  }

  // Export results
  const exportResults = () => {
    if (!status.results) {
      alert("Δεν υπάρχουν αποτελέσματα για εξαγωγή.")
      return
    }

    const dataToExport = {
      timestamp: new Date().toISOString(),
      result: status.results,
    }

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `opencar_application_results_${new Date().toISOString().split("T")[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Progress is now simpler, either 0, 50 (running), or 100 (completed)
  const progress = status.isRunning ? 50 : status.results ? 100 : 0

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">OpenCar Application Scraper</h1>
        <p className="text-muted-foreground">Ανάλυση δεδομένων από συγκεκριμένη σελίδα εφαρμογής gov.gr</p>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Σημαντικό:</strong> Αυτό το εργαλείο είναι για εκπαιδευτικούς σκοπούς.
          <br />
          **Για τοπική εκτέλεση:** Εάν εμφανιστεί CAPTCHA, θα ανοίξει ένα παράθυρο browser και θα πρέπει να το επιλύσετε
          χειροκίνητα.
          <br />
          **Για ανάπτυξη σε Vercel:** Το scraping εκτελείται σε headless λειτουργία (χωρίς ορατό browser). Εάν
          εμφανιστεί CAPTCHA, το scraping θα αποτύχει, καθώς η χειροκίνητη επίλυση δεν είναι δυνατή. Για
          αυτοματοποιημένη επίλυση CAPTCHA σε περιβάλλον serverless, απαιτείται ενσωμάτωση με εξειδικευμένη υπηρεσία.
          <br />
          Σεβαστείτε τους όρους χρήσης του gov.gr και χρησιμοποιήστε το υπεύθυνα.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="setup" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          {" "}
          {/* Reduced to 3 tabs */}
          <TabsTrigger value="setup">Ρύθμιση</TabsTrigger>
          <TabsTrigger value="scraping">Scraping</TabsTrigger>
          <TabsTrigger value="results">Αποτελέσματα</TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ρυθμίσεις Scraping</CardTitle>
              <CardDescription>Διαμορφώστε τις παραμέτρους για ασφαλές scraping</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="targetUrl">URL Εφαρμογής για Scraping</Label>
                <Input
                  id="targetUrl"
                  type="url"
                  placeholder="π.χ. https://dilosi.services.gov.gr/issue/..."
                  value={settings.targetUrl}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      targetUrl: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="delay">Καθυστέρηση μεταξύ αιτημάτων (δευτερόλεπτα)</Label>
                  <Input
                    id="delay"
                    type="number"
                    min="30"
                    max="300"
                    value={settings.delayBetweenRequests}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        delayBetweenRequests: Number.parseInt(e.target.value) || 60,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="retries">Μέγιστες επαναλήψεις</Label>
                  <Input
                    id="retries"
                    type="number"
                    min="1"
                    max="5"
                    value={settings.maxRetries}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        maxRetries: Number.parseInt(e.target.value) || 3,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="terms"
                  checked={settings.respectTerms}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      respectTerms: e.target.checked,
                    }))
                  }
                  className="rounded"
                />
                <Label htmlFor="terms" className="text-sm">
                  Συμφωνώ με τους όρους χρήσης του gov.gr και θα χρησιμοποιήσω το εργαλείο υπεύθυνα
                </Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scraping" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Κατάσταση Scraping</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    Κατάσταση: {status.isRunning ? "Σε εξέλιξη..." : status.results ? "Ολοκληρώθηκε" : "Αναμονή"}
                  </p>
                  {status.isRunning && (
                    <p className="text-sm text-muted-foreground">Scraping της σελίδας εφαρμογής...</p>
                  )}
                </div>

                <div className="flex gap-2">
                  {!status.isRunning && (
                    <Button onClick={startScraping} disabled={!settings.respectTerms || !settings.targetUrl}>
                      <Play className="mr-2 h-4 w-4" />
                      Έναρξη Scraping
                    </Button>
                  )}
                  {status.isRunning && (
                    <Button onClick={stopScraping} variant="destructive">
                      <Square className="mr-2 h-4 w-4" />
                      Διακοπή
                    </Button>
                  )}
                </div>
              </div>

              <Progress value={progress} className="w-full" />

              <div className="bg-black text-green-400 p-4 rounded-md font-mono text-sm h-64 overflow-y-auto">
                {status.logs.map((log, index) => (
                  <div key={index}>{log}</div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Αποτελέσματα Scraping
                {status.results && (
                  <Button onClick={exportResults} size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Εξαγωγή JSON
                  </Button>
                )}
              </CardTitle>
              <CardDescription>
                {status.results
                  ? status.results.success
                    ? "Επιτυχία"
                    : "Αποτυχία"
                  : "Δεν υπάρχουν αποτελέσματα ακόμα"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {status.results ? (
                <div
                  className={`p-3 rounded-md border ${
                    status.results.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Δεδομένα Εφαρμογής</span>
                    {status.results.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                  </div>

                  {status.results.success && status.results.data && (
                    <div className="mt-2 text-sm space-y-1">
                      {Object.entries(status.results.data).map(([key, value]) => (
                        <div key={key}>
                          <span className="text-muted-foreground">{key}:</span> {value}
                        </div>
                      ))}
                    </div>
                  )}

                  {!status.results.success && <p className="mt-1 text-sm text-red-600">{status.results.error}</p>}
                </div>
              ) : (
                <p className="text-muted-foreground">Δεν υπάρχουν αποτελέσματα ακόμα</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
