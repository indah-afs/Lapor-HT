import './globals.css';

export const metadata = {
  title: 'Laporan Lokasi Penggunaan HT',
  description: 'Laporkan titik penggunaan HT beserta foto buktinya.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
