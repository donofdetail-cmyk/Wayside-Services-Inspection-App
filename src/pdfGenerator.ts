import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { InspectionReport, CHECKLIST_ITEMS } from './types';

export async function generateAndSendPDF(report: InspectionReport): Promise<void> {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(22);
  doc.setTextColor(26, 54, 32); // Deep Forest Green (#1A3620)
  doc.text('Wayside Services LLC', 14, 20);
  
  doc.setFontSize(16);
  doc.setTextColor(59, 94, 65); // Pathway Green
  doc.text('Monthly Preventative Maintenance', 14, 30);
  
  // Client Info Section
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  
  doc.text(`Client Name: ${report.clientInfo.clientName}`, 14, 45);
  doc.text(`Email: ${report.clientInfo.clientEmail}`, 14, 52);
  doc.text(`Address: ${report.clientInfo.propertyAddress}`, 14, 59);
  doc.text(`Date: ${report.clientInfo.date}`, 14, 66);
  doc.text(`Technician: ${report.clientInfo.technicianName}`, 14, 73);

  const tableData = CHECKLIST_ITEMS.map((item, index) => {
    const data = report.checklist[index];
    let itemName = item;
    if (index === 9 && data?.seasonalTaskName) {
      itemName = `Seasonal: ${data.seasonalTaskName}`;
    }
    
    return [
      itemName,
      data?.status || 'N/A',
      data?.notes || ''
    ];
  });

  autoTable(doc, {
    startY: 85,
    head: [['Inspection Item', 'Status', 'Technician Notes']],
    body: tableData,
    headStyles: { fillColor: [59, 94, 65] }, // Pathway Green
    styles: { overflow: 'linebreak', cellWidth: 'wrap' },
    columnStyles: { 
      0: { cellWidth: 70 },
      1: { cellWidth: 30 },
      2: { cellWidth: 'auto' }
    }
  });
  
  // Photos handling
  let currentY = (doc as any).lastAutoTable.finalY + 15;
  let hasPhotos = false;
  
  for (let i = 0; i < CHECKLIST_ITEMS.length; i++) {
    const data = report.checklist[i];
    if (data?.photoUrl) {
      if (!hasPhotos) {
        doc.addPage();
        currentY = 20;
        doc.setFontSize(16);
        doc.text('Inspection Photos', 14, currentY);
        currentY += 10;
        hasPhotos = true;
      }
      
      const itemName = i === 9 && data.seasonalTaskName ? data.seasonalTaskName : CHECKLIST_ITEMS[i];
      doc.setFontSize(12);
      doc.text(itemName, 14, currentY);
      currentY += 5;
      
      try {
        doc.addImage(data.photoUrl, 'JPEG', 14, currentY, 80, 60);
      } catch (e) {
        console.error("Failed to add image to PDF", e);
      }
      currentY += 70;
      
      if (currentY > 230) {
        doc.addPage();
        currentY = 20;
      }
    }
  }

  // Convert to Base64 avoiding huge stack limits
  const pdfBase64 = doc.output('datauristring');
  
  // Send via API
  const response = await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pdfBase64,
      clientEmail: report.clientInfo.clientEmail,
      clientName: report.clientInfo.clientName
    })
  });
  
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to send email');
  }
}
