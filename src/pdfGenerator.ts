import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { InspectionReport } from './types';
import { dmSansBoldBase64 } from './fonts';

export async function generateAndDownloadPDF(
  report: InspectionReport,
  templateItems: string[]
): Promise<Blob> {
  const doc = new jsPDF();

  // Render Logo
  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="192" height="192" fill="none">
    <path d="M8 22L24 8L40 22V40C40 41.1 39.1 42 38 42H10C8.9 42 8 41.1 8 40V22Z" fill="#1D9E75"/>
    <path d="M4 24L24 6L44 24" stroke="#1D9E75" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="20" y="30" width="8" height="12" rx="1" fill="#16795A"/>
    <circle cx="34" cy="14" r="8" fill="#1D9E75" stroke="white" stroke-width="2.5"/>
    <path d="M30.5 14L33 16.5L37.5 11.5" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  const svg64 = btoa(svgString);
  const image64 = 'data:image/svg+xml;base64,' + svg64;

  const logoImg = new Image();
  logoImg.src = image64;
  await new Promise((resolve) => {
    logoImg.onload = resolve;
    logoImg.onerror = resolve;
  });

  const canvas = document.createElement('canvas');
  canvas.width = 192;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(logoImg, 0, 0, 192, 192);
  }
  const pngDataUrl = canvas.toDataURL('image/png');

  doc.addImage(pngDataUrl, 'PNG', 14, 10, 14, 14);

  // Logo Text
  doc.addFileToVFS('DMSans-Bold.ttf', dmSansBoldBase64);
  doc.addFont('DMSans-Bold.ttf', 'DMSans', 'bold');

  doc.setFont('DMSans', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(27, 58, 45); // Deep Forest Green (#1B3A2D)
  (doc as any).text('Wayside', 31, 16.5, { charSpace: -0.15 });

  doc.setFontSize(8.25);
  doc.setTextColor(29, 158, 117); // Pathway Green (#1D9E75)
  (doc as any).text('SERVICES', 31, 20.8, { charSpace: 0.7 });

  // Reset font for remainder of document
  doc.setFont('helvetica', 'normal');

  // Client Info Section
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);

  doc.text(`Client Name: ${report.clientInfo.clientName}`, 14, 45);
  doc.text(`Email: ${report.clientInfo.clientEmail}`, 14, 52);
  doc.text(`Address: ${report.clientInfo.propertyAddress}`, 14, 59);
  doc.text(`Date: ${report.clientInfo.date}`, 14, 66);
  doc.text(`Technician: ${report.clientInfo.technicianName}`, 14, 73);

  const tableData = templateItems.map((item, index) => {
    const data = report.checklist[index];
    let itemName = item;
    if (index === templateItems.length - 1 && data?.seasonalTaskName) {
      itemName = `Seasonal: ${data.seasonalTaskName}`;
    }

    let notesText = data?.notes || '';
    if (data?.rooms && data.rooms.length > 0) {
      const roomNotes = data.rooms.map(r => `• ${r.name || 'Unnamed Room'}: ${r.notes || 'No notes'}`).join('\n');
      notesText = notesText ? `${notesText}\n\nRooms:\n${roomNotes}` : `Rooms:\n${roomNotes}`;
    }

    return [
      itemName,
      data?.status || 'N/A',
      notesText
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

  for (let i = 0; i < templateItems.length; i++) {
    const data = report.checklist[i];
    if (data?.photoUrls && data.photoUrls.length > 0) {
      if (!hasPhotos) {
        doc.addPage();
        currentY = 20;
        doc.setFontSize(16);
        doc.text('Inspection Photos', 14, currentY);
        currentY += 10;
        hasPhotos = true;
      }

      const itemName = i === templateItems.length - 1 && data.seasonalTaskName ? data.seasonalTaskName : templateItems[i];
      doc.setFontSize(12);
      doc.text(itemName, 14, currentY);
      currentY += 5;

      for (const photoUrl of data.photoUrls) {
        try {
          // Verify it's a data URL before adding
          if (photoUrl.startsWith('data:image/')) {
            doc.addImage(photoUrl, 'JPEG', 14, currentY, 80, 60);
            currentY += 70;

            if (currentY > 230) {
              doc.addPage();
              currentY = 20;
            }
          }
        } catch (e) {
          console.error("Failed to add image to PDF", e);
        }
      }
    }
  }

  // Signatures
  doc.addPage();
  currentY = 20;
  doc.setFontSize(16);
  doc.text('Sign Off', 14, currentY);
  currentY += 15;

  doc.setFontSize(12);
  doc.text('Technician Signature:', 14, currentY);
  if (report.technicianSignature) {
    try {
      doc.addImage(report.technicianSignature, 'PNG', 14, currentY + 5, 80, 30);
    } catch(e) {}
  }
  
  currentY += 50;
  doc.text('Client Signature:', 14, currentY);
  if (report.clientSignature) {
    try {
      doc.addImage(report.clientSignature, 'PNG', 14, currentY + 5, 80, 30);
    } catch(e) {}
  }

  // Download PDF
  const pdfFileName = `${report.clientInfo.clientName.replace(/\s+/g, '_')}_Inspection_Report.pdf`;
  doc.save(pdfFileName);

  // Download photos separately
  for (let i = 0; i < templateItems.length; i++) {
    const data = report.checklist[i];
    if (data?.photoUrls && data.photoUrls.length > 0) {
      const itemName = i === templateItems.length - 1 && data.seasonalTaskName ? data.seasonalTaskName : templateItems[i];
      const safeItemName = itemName.replace(/[^a-zA-Z0-9]/g, '_');
      
      data.photoUrls.forEach((photoUrl, idx) => {
        const fileName = `${report.clientInfo.clientName.replace(/\s+/g, '_')}_${safeItemName}_Photo_${idx+1}.jpg`;

        // Trigger download for each photo
        const link = document.createElement('a');
        link.href = photoUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
    }
  }

  return doc.output('blob');
}
