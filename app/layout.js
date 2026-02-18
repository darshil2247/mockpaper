// app/layout.js
export const metadata = {
  title: "MockPaper AI — IB Mathematics Exam Generator",
  description: "Generate original IB Mathematics mock papers and mark schemes instantly.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
