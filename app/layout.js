import './globals.css';
import './tambahan.css';

export const metadata = {
  title: 'Laporan Penggunaan HT - Balmon SFRID Kelas I Makassar',
  description: 'Laporkan titik penggunaan HT beserta foto buktinya.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
