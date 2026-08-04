export interface LoanApplicationPDFData {
  applicationId: string;
  studentId: string;
  studentName: string;
  studentUsername: string;
  applicationDate: string;
  loanAmount: number;
  firstChoiceName: string | null;
  secondChoiceName: string | null;
  thirdChoiceName: string | null;
  status: string;
}

export async function downloadLoanApplicationPDF(data: LoanApplicationPDFData): Promise<Blob> {
  try {
    const jsPDFModule = await import('jspdf');
    const autoTableModule = await import('jspdf-autotable');
    const jsPDF = (jsPDFModule as any).default || jsPDFModule;
    const autoTable = (autoTableModule as any).default || autoTableModule;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(18);
    doc.text('MaiTroll Academy Loan Application', 14, 24);

    doc.setFontSize(11);
    doc.setTextColor(99, 110, 114);
    doc.text(`Application ID: ${data.applicationId}`, 14, 34);
    doc.text(`Submitted: ${data.applicationDate}`, 14, 40);
    doc.text(`Status: ${data.status.replace('_', ' ')}`, 14, 46);

    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text('Student Information', 14, 62);
    autoTable(doc, {
      startY: 68,
      head: [['Field', 'Value']],
      body: [
        ['Student Name', data.studentName || 'N/A'],
        ['Username', data.studentUsername || 'N/A'],
        ['Student ID', data.studentId],
      ],
      theme: 'grid',
      headStyles: { fillColor: [22, 160, 133] },
      styles: { fontSize: 10 },
    });

    const loanTableY = (doc as any).lastAutoTable?.finalY || 100;
    doc.setFontSize(12);
    doc.text('Loan Request Details', 14, loanTableY + 18);
    autoTable(doc, {
      startY: loanTableY + 22,
      head: [['Detail', 'Selection']],
      body: [
        ['Loan Amount', `${data.loanAmount.toLocaleString()} coins`],
        ['First Choice', data.firstChoiceName || 'Not selected'],
        ['Second Choice', data.secondChoiceName || 'Not selected'],
        ['Third Choice', data.thirdChoiceName || 'Not selected'],
      ],
      theme: 'grid',
      headStyles: { fillColor: [39, 174, 96] },
      styles: { fontSize: 10 },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || loanTableY + 100;
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text('Loan Payback Rules & Guidelines', 14, finalY + 18);
    const rules = [
      'Loan covers the full enrollment fee for the requested Academy course.',
      'Loan approval allows enrollment even if your current coin balance is insufficient.',
      'Repayment must follow Academy schedules and may be deducted from future earnings or coin balances.',
      'Failure to repay on time can affect future loan eligibility and Academy enrollment privileges.',
      'The student agrees to cooperate with Academy review and repayment tracking until the loan is fully repaid.',
    ];
    doc.setFontSize(10);
    rules.forEach((rule, index) => {
      doc.text(`• ${rule}`, 16, finalY + 28 + index * 6);
    });

    const signatureY = finalY + 28 + rules.length * 6 + 14;
    doc.setFontSize(10);
    doc.setTextColor(66, 66, 66);
    doc.text('I certify that the information above is complete and accurate, and I agree to the Academy loan payback rules and guidelines.', 14, signatureY);
    doc.text('Student Signature: _________________________________', 14, signatureY + 12);
    doc.text('Date: ____________________________', 14, signatureY + 22);

    doc.setFontSize(10);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      14,
      doc.internal.pageSize.getHeight() - 10
    );

    const filename = `MaiTroll_LoanApplication_${data.studentUsername}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);

    return doc.output('blob');
  } catch (error: any) {
    console.error('[LoanApplicationPDF] Error generating PDF:', error);
    alert('Loan application PDF generation failed. Please make sure jspdf and jspdf-autotable are installed.');
    throw error;
  }
}
