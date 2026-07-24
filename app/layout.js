export const metadata = {
  title: 'Home Stock - ระบบสต๊อกของใช้ในบ้าน',
  description: 'จัดการของใช้ในบ้าน สะดวก รวดเร็ว',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <style>{`* { font-family: 'Sarabun', sans-serif; }`}</style>
      </head>
      <body className="bg-slate-50 text-slate-800 min-h-screen pb-12">{children}</body>
    </html>
  );
}
