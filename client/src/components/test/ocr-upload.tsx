import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Loader, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  status: "uploading" | "processing" | "complete" | "error";
  progress: number;
  data?: {
    text: string;
    confidence: number;
  };
}

interface OCRUploadProps {
  onOCRComplete?: (text: string, confidence: number) => void;
}

export function OCRUpload({ onOCRComplete }: OCRUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const { toast } = useToast();

  // Track which file ID is currently being processed
  const [processingFileId, setProcessingFileId] = useState<string | null>(null);

  const processOCRMutation = useMutation({
    mutationFn: async (imageData: string) => {
      const response = await apiRequest("POST", "/api/ocr", { imageData });
      return response.json();
    },
    onSuccess: (data) => {
      const fileId = processingFileId;
      if (fileId) {
        // Update file status
        setFiles((prev) =>
          prev.map((file) =>
            file.id === fileId
              ? {
                  ...file,
                  status: "complete",
                  progress: 100,
                  data: {
                    text: data.text,
                    confidence: data.confidence,
                  },
                }
              : file
          )
        );

        // Call the callback if provided
        if (onOCRComplete) {
          onOCRComplete(data.text, data.confidence);
        }

        toast({
          title: "OCR Processing Complete",
          description: `File has been processed with ${data.confidence.toFixed(2)}% confidence.`,
        });
      }
    },
    onError: (error) => {
      const fileId = processingFileId;
      if (fileId) {
        // Update file status
        setFiles((prev) =>
          prev.map((file) =>
            file.id === fileId
              ? {
                  ...file,
                  status: "error",
                  progress: 100,
                }
              : file
          )
        );
      }

      toast({
        title: "OCR Processing Failed",
        description:
          error instanceof Error ? error.message : "An error occurred during OCR processing",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    // Process each selected file
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const fileId = Date.now().toString() + i;

      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds the 10MB limit`,
          variant: "destructive",
        });
        continue;
      }

      // Check file type
      if (!["image/jpeg", "image/jpg", "image/png", "application/pdf"].includes(file.type)) {
        toast({
          title: "Unsupported file type",
          description: `${file.name} must be JPG, PNG, or PDF`,
          variant: "destructive",
        });
        continue;
      }

      // Add file to state
      setFiles((prev) => [
        ...prev,
        {
          id: fileId,
          name: file.name,
          size: file.size,
          status: "uploading",
          progress: 0,
        },
      ]);

      // Read file as data URL
      const reader = new FileReader();
      reader.onloadstart = () => {
        // Update progress to 10%
        setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, progress: 10 } : f)));
      };

      reader.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 50);
          setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, progress } : f)));
        }
      };

      reader.onload = () => {
        // Update progress to 60% and status to processing
        setFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, status: "processing", progress: 60 } : f))
        );

        // Get base64 data
        const base64Data = reader.result as string;
        const base64Content = base64Data.split(",")[1];

        // Process with OCR
        setProcessingFileId(fileId);
        processOCRMutation.mutate(base64Content);
      };

      reader.onerror = () => {
        setFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, status: "error", progress: 100 } : f))
        );

        toast({
          title: "Upload Failed",
          description: `Failed to read ${file.name}`,
          variant: "destructive",
        });
      };

      reader.readAsDataURL(file);
    }

    // Reset input
    e.target.value = "";
  };

  const getFileIcon = (file: UploadedFile) => {
    switch (file.status) {
      case "uploading":
      case "processing":
        return <Loader className="h-5 w-5 animate-spin" />;
      case "complete":
        return <CheckCircle className="h-5 w-5 text-secondary" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const getStatusText = (file: UploadedFile) => {
    switch (file.status) {
      case "uploading":
        return "Uploading...";
      case "processing":
        return "Processing OCR...";
      case "complete":
        return `Completed (${file.data?.confidence.toFixed(0)}% confidence)`;
      case "error":
        return "Error processing file";
      default:
        return "";
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const fileInput = document.getElementById("file-upload") as HTMLInputElement;
      fileInput.files = e.dataTransfer.files;
      const event = new Event("change", { bubbles: true });
      fileInput.dispatchEvent(event);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="space-y-4">
      <div
        className="rounded-lg border-2 border-dashed border-neutral-300 p-6 text-center dark:border-neutral-700"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <div className="flex flex-col items-center">
          <Upload className="mb-2 h-10 w-10 text-muted-foreground" />
          <p className="mb-2 text-sm">Drag and drop answer sheets or</p>
          <div>
            <input
              id="file-upload"
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            <Button onClick={() => document.getElementById("file-upload")?.click()}>
              Browse Files
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Supports JPG, PNG, PDF (Max 10MB per file)
          </p>
        </div>
      </div>

      {files.length > 0 && (
        <div>
          <h4 className="mb-2 font-medium">Uploaded Files</h4>
          <div className="space-y-2">
            {files.map((file) => (
              <div key={file.id} className="flex items-center rounded-md bg-muted p-3">
                <div className="mr-3 text-primary">{getFileIcon(file)}</div>
                <div className="flex-1">
                  <div className="flex justify-between">
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <div className="mt-1">
                    <Progress value={file.progress} className="h-1" />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{getStatusText(file)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
