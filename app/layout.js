import "./globals.css";

export const metadata = {
  title: "Meme Vault",
  description: "Your meme clips and sound effects, tagged by moment, saved in Google Drive.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0e0e13",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
