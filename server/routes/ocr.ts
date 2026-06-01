import { Router, Request, Response } from "express";
import { processOCRImage } from "../lib/tesseract";
import { authenticateToken } from "../middleware";

const router = Router();

// Middleware to protect subsequent routes
router.use(authenticateToken);

// POST /api/ocr — extract text from image using OCR
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

// POST /api/ocr/extract — legacy/mobile compatibility
router.post("/extract", async (req: Request, res: Response) => {
  try {
    const { image } = req.body;
    if (!image || typeof image !== "string") {
      return res.status(400).json({ message: "Image data is required" });
    }

    const result = await processOCRImage(image);
    
    return res.status(200).json({
      text: result.text,
      confidence: result.confidence,
      language: (result as any).language || "en",
    });
  } catch (error) {
    console.error("OCR processing error:", error);
    return res.status(500).json({ message: "Failed to process image" });
  }
});

export default router;
