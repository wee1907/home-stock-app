export const metadata = {
  title: 'Home Stock - ระบบจัดการของใช้ในบ้าน',
  description: 'จัดการสต๊อกของใช้ในบ้าน สะดวก รวดเร็ว สวยงาม',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th" className="dark">
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
        <script dangerouslySetInnerHTML={{
          __html: `
            tailwind = {
              darkMode: 'class',
              theme: {
                extend: {
                  fontFamily: {
                    sans: ['Prompt', 'Sarabun', 'sans-serif'],
                  }
                }
              }
            }
          `
        }} />
        <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <style>{`* { font-family: 'Prompt', sans-serif; }`}</style>
      </head>
      <body className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 transition-colors duration-300">
        {children}
      </body>
    </html>
  );
}
