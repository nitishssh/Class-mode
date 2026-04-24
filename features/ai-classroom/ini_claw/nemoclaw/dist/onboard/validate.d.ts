export interface ValidationResult {
    valid: boolean;
    models: string[];
    error: string | null;
}
export declare function validateApiKey(apiKey: string, endpointUrl: string): Promise<ValidationResult>;
export declare function maskApiKey(apiKey: string): string;
//# sourceMappingURL=validate.d.ts.map