export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Logo */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center">
          <span className="text-lg font-bold text-gray-900 tracking-tight">BotSales</span>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
