// Weekly Role Perk PDF Generator
// Generates PDF reports for officer weekly Treasury perk payments

// Note: You'll need to install jspdf and jspdf-autotable:
// npm install jspdf jspdf-autotable
// npm install --save-dev @types/jspdf

interface PerkReport {
  officerName: string
  rank: string
  totalEarned: number
  perkPeriod: string
  logs: any[]
}

/**
 * Downloads a PDF report for weekly role perks
 * @param report - The weekly perk report data
 */
export async function downloadPayrollPDF(report: PerkReport) {
  try {
    // Dynamic import for jspdf
    const jsPDFModule = await import('jspdf')
    const autoTableModule = await import('jspdf-autotable')
    
    const jsPDF = (jsPDFModule as any).default || jsPDFModule
    const autoTable = (autoTableModule as any).default || autoTableModule
    
    const doc = new jsPDF()

    // Title
    doc.setFontSize(18)
    doc.text('MaiTroll Weekly Role Perk Report', 14, 22)

    // Officer Information
    doc.setFontSize(12)
    doc.text(`Officer: ${report.officerName}`, 14, 35)
    doc.text(`Rank: ${report.rank}`, 14, 42)
    doc.text(`Perk Period: ${report.perkPeriod}`, 14, 49)

    // Perk Summary Table
    autoTable(doc, {
      startY: 60,
      head: [['Metric', 'Value']],
      body: [
        ['Total Perk Coins', Number(report.totalEarned || 0).toLocaleString()],
        ['Log Count', report.logs.length.toString()],
      ],
      theme: 'striped',
      headStyles: { fillColor: [66, 139, 202] },
      styles: { fontSize: 10 }
    })

    // Treasury perk info
    const finalY = (doc as any).lastAutoTable?.finalY || 100
    doc.setFontSize(10)
    doc.text('Weekly perk payments are processed through the Mai Troll Treasury.', 14, finalY + 15)
    doc.text('Perks are not hourly wages or employment compensation.', 14, finalY + 22)
    
    const estimatedPayout = (Number(report.totalEarned || 0) * 0.01).toFixed(2)
    doc.setFontSize(12)
    doc.text(`Estimated Treasury Value: $${estimatedPayout}`, 14, finalY + 32)
    
    // Footer
    doc.setFontSize(8)
    doc.setTextColor(128, 128, 128)
    doc.text(
      `Generated on ${new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}`,
      14,
      doc.internal.pageSize.height - 10
    )

    // Save PDF
    const filename = `MaiTroll_RolePerk_${report.officerName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
    doc.save(filename)
  } catch (error: any) {
    console.error('[OfficerPayrollPDF] Error generating PDF:', error)
    alert('PDF generation failed. Please install jspdf: npm install jspdf jspdf-autotable')
  }
}
