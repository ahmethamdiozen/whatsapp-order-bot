export type Language = 'en' | 'tr';

const messages = {
  en: {
    welcome: '👋 Welcome! Please select your language:\n\n1️⃣ English\n2️⃣ Türkçe',
    selectLocation: '🏪 Please select a branch:',
    locationSelected: (name: string) => `📍 *${name}* selected. Here is our menu:`,
    invalidLocation: 'Please type 1, 2, or 3 to select a branch.',
    itemAdded: (qty: number, name: string, total: number) =>
      `✅ ${qty}x *${name}* added to cart.\n*Cart total: $${total.toFixed(2)}*`,
    cartEmpty: '🛒 Your cart is empty. Please select items from the menu first.',
    orderSummaryHeader: '✅ *Order Summary:*',
    orderTotal: (total: number) => `*Total: $${total.toFixed(2)}*`,
    confirmPrompt: 'Type *YES* to confirm or *BACK* to return to menu.',
    orderConfirmed: (id: number) => `🎉 Order *#${id}* confirmed! We\'ll start preparing it shortly.`,
    orderCancelled: '❌ Order cancelled. Your cart has been cleared.',
    cartLabel: '🛒 *Your Cart:*',
    cartEmptyLabel: '🛒 Your cart is empty.',
    removeHint: 'Type *REMOVE [item]* to remove an item or *NOTE [item]: [text]* to add special instructions.',
    itemNotFound: (name: string) => `❌ *${name}* not found in your cart.`,
    itemRemoved: (name: string) => `🗑️ *${name}* removed from cart.`,
    cartCleared: '🛒 Cart cleared.',
    noOrders: '📋 You have no previous orders.',
    ordersHeader: '📋 *Your recent orders:*',
    orderLine: (id: number, total: number, status: string, date: string) =>
      `• Order #${id} — $${total.toFixed(2)} — ${status} — ${date}`,
    reorderLoaded: '🔄 Your previous order has been loaded into the cart.',
    noReorder: '❌ No previous orders found to reorder.',
    invalidOption: 'I didn\'t understand that. Please use the menu buttons or type your order.',
    removeFormat: '❌ Format: *REMOVE [item name]*',
    noteAdded: (name: string, note: string) => `📝 Note added to *${name}*: "${note}"`,
    noteFormat: '❌ Format: *NOTE [item name]: [your note]*\nExample: NOTE Burger: no onions',
    noteItemNotFound: (name: string) => `❌ *${name}* not found in your cart.`,
    promoApplied: (code: string, discount: number, total: number) =>
      `✅ Promo code *${code}* applied!\n💰 Discount: -$${discount.toFixed(2)}\n*New total: $${total.toFixed(2)}*`,
    rateLimited: 'Too many messages. Please wait a moment.',
    paymentLink: (url: string) => `💳 *Pay for your order:*\n${url}`,
    paymentLinkFailed: '⚠️ Order saved but payment link could not be created. Please ask staff to process payment.',
    menuButton: 'Menu',
    checkoutButton: 'Checkout',
    clearCartButton: 'Clear Cart',
    newOrderButton: 'New Order',
    myOrdersButton: 'My Orders',
    reorderButton: '🔄 Reorder',
  },
  tr: {
    welcome: '👋 Hoş geldiniz! Lütfen dilinizi seçin:\n\n1️⃣ English\n2️⃣ Türkçe',
    selectLocation: '🏪 Lütfen bir şube seçin:',
    locationSelected: (name: string) => `📍 *${name}* seçildi. Menümüz:`,
    invalidLocation: 'Şube seçmek için lütfen 1, 2 veya 3 yazın.',
    itemAdded: (qty: number, name: string, total: number) =>
      `✅ ${qty}x *${name}* sepete eklendi.\n*Sepet toplamı: $${total.toFixed(2)}*`,
    cartEmpty: '🛒 Sepetiniz boş. Lütfen önce menüden ürün seçin.',
    orderSummaryHeader: '✅ *Sipariş Özeti:*',
    orderTotal: (total: number) => `*Toplam: $${total.toFixed(2)}*`,
    confirmPrompt: 'Onaylamak için *EVET* yazın veya menüye dönmek için *GERİ* yazın.',
    orderConfirmed: (id: number) => `🎉 *#${id}* numaralı siparişiniz alındı! Kısa süre içinde hazırlanmaya başlanacak.`,
    orderCancelled: '❌ Sipariş iptal edildi. Sepetiniz temizlendi.',
    cartLabel: '🛒 *Sepetiniz:*',
    cartEmptyLabel: '🛒 Sepetiniz boş.',
    removeHint: 'Ürün kaldırmak için *KALDIR [ürün]* veya not eklemek için *NOT [ürün]: [metin]* yazın.',
    itemNotFound: (name: string) => `❌ *${name}* sepetinizde bulunamadı.`,
    itemRemoved: (name: string) => `🗑️ *${name}* sepetten kaldırıldı.`,
    cartCleared: '🛒 Sepet temizlendi.',
    noOrders: '📋 Daha önce verdiğiniz bir sipariş yok.',
    ordersHeader: '📋 *Son siparişleriniz:*',
    orderLine: (id: number, total: number, status: string, date: string) =>
      `• Sipariş #${id} — $${total.toFixed(2)} — ${status} — ${date}`,
    reorderLoaded: '🔄 Önceki siparişiniz sepete yüklendi.',
    noReorder: '❌ Tekrar sipariş verilecek önceki sipariş bulunamadı.',
    invalidOption: 'Anlamadım. Lütfen menü butonlarını kullanın veya siparişinizi yazın.',
    removeFormat: '❌ Format: *KALDIR [ürün adı]*',
    noteAdded: (name: string, note: string) => `📝 *${name}* için not eklendi: "${note}"`,
    noteFormat: '❌ Format: *NOT [ürün adı]: [notunuz]*\nÖrnek: NOT Burger: soğansız',
    noteItemNotFound: (name: string) => `❌ *${name}* sepetinizde bulunamadı.`,
    promoApplied: (code: string, discount: number, total: number) =>
      `✅ *${code}* promosyon kodu uygulandı!\n💰 İndirim: -$${discount.toFixed(2)}\n*Yeni toplam: $${total.toFixed(2)}*`,
    rateLimited: 'Çok fazla mesaj gönderildi. Lütfen bir süre bekleyin.',
    paymentLink: (url: string) => `💳 *Siparişiniz için ödeme yapın:*\n${url}`,
    paymentLinkFailed: '⚠️ Sipariş kaydedildi ancak ödeme bağlantısı oluşturulamadı. Lütfen personelden yardım isteyin.',
    menuButton: 'Menü',
    checkoutButton: 'Sipariş Ver',
    clearCartButton: 'Sepeti Temizle',
    newOrderButton: 'Yeni Sipariş',
    myOrdersButton: 'Siparişlerim',
    reorderButton: '🔄 Tekrarla',
  },
};

type Messages = typeof messages['en'];

export function t(lang: Language): Messages {
  return (messages[lang] ?? messages['en']) as unknown as Messages;
}
