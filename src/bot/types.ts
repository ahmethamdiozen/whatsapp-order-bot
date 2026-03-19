export interface OrderItem {
    name: string;
    quantity: number;
    notes?: string;
}

export interface ParsedOrder {
    intent: 'order' | 'question' | 'cancel' | 'other';
    items: OrderItem[];
    rawMessage: string;
}