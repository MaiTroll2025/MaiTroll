export function printElement(elementId: string) {
  const element = document.getElementById(elementId)
  if (!element) return

  const printWindow = window.open('', '_blank', 'width=800,height=600')
  if (!printWindow) return

  printWindow.document.write(`
    <html>
      <head>
        <title>Print Label</title>
        <style>
          @media print {
            body { margin: 0; padding: 0; }
            @page { margin: 0; size: auto; }
          }
          body { display: flex; justify-content: center; align-items: flex-start; padding: 10px; }
        </style>
      </head>
      <body>
        ${element.innerHTML}
      </body>
    </html>
  `)
  printWindow.document.close()
  setTimeout(() => {
    printWindow.print()
    printWindow.close()
  }, 250)
}
