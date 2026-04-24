import { useState } from "react";
import { OCRUpload } from "@/components/test/ocr-upload";
import { OCRProcessing } from "@/components/test/ocr-processing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScanBarcode, FileText, Lightbulb } from "lucide-react";

/**
 * OCR Answer Scanning page. Lets teachers upload handwritten answer sheets,
 * OCR-processes them, and displays confidence analysis results.
 */
export default function OcrScan() {
  const [ocrText, setOcrText] = useState<string>("");
  const [ocrConfidence, setOcrConfidence] = useState<number>(0);

  const handleOCRComplete = (text: string, confidence: number) => {
    setOcrText(text);
    setOcrConfidence(confidence);
  };

  const confidenceColor =
    ocrConfidence >= 90
      ? "from-emerald-500 to-teal-600"
      : ocrConfidence >= 70
        ? "from-amber-500 to-orange-500"
        : "from-red-500 to-rose-600";

  const confidenceLabel = ocrConfidence >= 90 ? "Excellent" : ocrConfidence >= 70 ? "Good" : "Low";

  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 p-2.5 text-white shadow-md">
            <ScanBarcode className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">OCR Answer Scanning</h1>
            <p className="text-sm text-muted-foreground">
              Upload and process handwritten test answers with AI
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Upload card */}
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-emerald-500/10 p-1.5">
                <ScanBarcode className="h-4 w-4 text-emerald-500" />
              </div>
              <CardTitle className="text-base font-semibold">Upload Answer Sheets</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <OCRUpload onOCRComplete={handleOCRComplete} />
          </CardContent>
        </Card>

        {/* Processing card */}
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-blue-500/10 p-1.5">
                <FileText className="h-4 w-4 text-blue-500" />
              </div>
              <CardTitle className="text-base font-semibold">OCR Processing</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <OCRProcessing initialOCRText={ocrText} />
          </CardContent>
        </Card>
      </div>

      {/* OCR Confidence Analysis */}
      {ocrConfidence > 0 && (
        <Card className="mt-6 transition-shadow hover:shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-purple-500/10 p-1.5">
                <Lightbulb className="h-4 w-4 text-purple-500" />
              </div>
              <CardTitle className="text-base font-semibold">OCR Confidence Analysis</CardTitle>
              <Badge
                className={`ml-auto text-xs font-bold ${
                  ocrConfidence >= 90
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : ocrConfidence >= 70
                      ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      : "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400"
                }`}
              >
                {confidenceLabel} Confidence
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              {/* Confidence bar */}
              <div>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-medium">Overall Confidence</span>
                  <span className="font-bold">{ocrConfidence.toFixed(1)}%</span>
                </div>
                <div className="relative h-3 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${confidenceColor} transition-all duration-700`}
                    style={{ width: `${ocrConfidence}%` }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Tips */}
              <div className="rounded-xl border border-border/60 bg-muted/40 p-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  Recognition Tips
                </p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>Ensure handwriting is clear and not too small</li>
                  <li>Use good lighting when taking photos of answer sheets</li>
                  <li>Avoid shadows and glare on the paper</li>
                  <li>Keep the camera perpendicular to the page</li>
                  <li>Review AI-recognized text and edit if necessary</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
