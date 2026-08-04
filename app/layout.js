import './globals.css';

export const metadata = {
  title: 'Home Stock - ระบบจัดการของใช้ในบ้าน',
  description: 'จัดการสต๊อกของใช้ในบ้าน สะดวก รวดเร็ว สวยงาม',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@400;500;600;700;800&family=IBM+Plex+Sans+Thai:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-cream dark:bg-ink-950 text-ink-800 dark:text-ink-100 transition-colors duration-300">
        {children}
      </body>
    </html>
  );
}
