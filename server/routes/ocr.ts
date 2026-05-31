import { Router, Request, Response } from "express";
import { processOCRImage } from "../lib/tesseract";

const router = Router();

// POST /api/ocr — extract text from image using OCR (Old endpoint)
router.post("/", async (req: Request, res: Response) => {
  try {
    const { imageData } = req.body;

    if (!imageData) {
      return res.status(400).json({ message: "Image data is required" });
    }

    const result = await processOCRImage(imageData);
    res.status(200).json(result);
  } catch (error) {
    console.error("OCR processing error:", error);
    res.status(500).json({ message: "Failed to process OCR" });
  }
});

// POST /api/ocr/extract — legacy/mobile compatibility (Now points to real OCR)
router.post("/extract", async (req: Request, res: Response) => {
  try {
    const { image } = req.body;
    if (!image || typeof image !== "string") {
      return res.status(400).json({ message: "Image data is required" });
    }

    const result = await processOCRImage(image);
    
    // Maintain backward compatibility for mobile client
    return res.status(200).json({
      text: result.text,
      confidence: result.confidence,
      language: result.language || "en",
    });
  } catch (error) {
    console.error("OCR processing error:", error);
    return res.status(500).json({ message: "Failed to process image" });
  }
});

export default router;
