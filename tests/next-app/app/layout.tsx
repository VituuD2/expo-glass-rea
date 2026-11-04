import '@expo-glass-rea/react/styles.css';

export const metadata = { title: 'Next.js glass integration' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body style={{ margin: 0, fontFamily: 'system-ui', colorScheme: 'light dark' }}>{children}</body></html>;
}
