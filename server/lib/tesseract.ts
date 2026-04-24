import Tesseract from "tesseract.js";

interface OCRResult {
  text: string;
  confidence: number;
}

export async function processOCRImage(imageData: string): Promise<OCRResult> {
  try {
    // Remove data URL prefix if present
    const base64Data = imageData.includes("base64,") ? imageData.split("base64,")[1] : imageData;

    // Process image with Tesseract
    const result = await Tesseract.recognize(`data:image/jpeg;base64,${base64Data}`, "eng", {
      logger: (m) => console.log(m),
    });

    return {
      text: result.data.text,
      confidence: result.data.confidence,
    };
  } catch (error) {
    console.error("OCR processing error:", error);
    throw new Error("Failed to process image with OCR");
  }
}
