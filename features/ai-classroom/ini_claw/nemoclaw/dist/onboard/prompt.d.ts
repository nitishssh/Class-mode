export interface SelectOption {
    label: string;
    value: string;
    hint?: string;
}
export declare function promptInput(question: string, defaultValue?: string): Promise<string>;
export declare function promptConfirm(question: string, defaultYes?: boolean): Promise<boolean>;
export declare function promptSelect(question: string, options: SelectOption[], defaultIndex?: number): Promise<string>;
//# sourceMappingURL=prompt.d.ts.map