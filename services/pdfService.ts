
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SiteReport } from '../types';

export const generatePDF = async (report: SiteReport) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  const centerText = (text: string, y: number, size = 12, style = 'normal') => {
    doc.setFontSize(size);
    doc.setFont('helvetica', style);
    const textWidth = doc.getTextWidth(text);
    doc.text(text, (pageWidth - textWidth) / 2, y);
  };

  const loadImageAsDataUrl = async (url: string) => {
    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const loadImageSize = async (dataUrl: string) => {
    return await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = dataUrl;
    });
  };

  let headerLogoDataUrl: string | null = null;
  let headerLogoSize: { width: number; height: number } | null = null;
  try {
    const logoUrl = new URL('../kohlreiter.png', import.meta.url).toString();
    headerLogoDataUrl = await loadImageAsDataUrl(logoUrl);
    headerLogoSize = await loadImageSize(headerLogoDataUrl);
  } catch (error) {
    headerLogoDataUrl = null;
    headerLogoSize = null;
  }

  const drawFirstPageFooter = () => {
    const footerLines = [
      [
        'Kohlreiter Immobilien &',
        'Projektmanagement GmbH',
        'Wasserfeld 1a',
        '6361 Hopfgarten'
      ],
      [
        'Mobil Marcel: +43 (0) 664 / 75 113 306',
        'Mobil Andreas: +43 (0) 678 / 125 0 145',
        'E-Mail: buero@kohlreiter.at',
        'Internet: www.kohlreiter.at'
      ],
      [
        'Bankverbindung',
        'HYPO Tirol Bank Kitzbühel',
        'IBAN: AT73 5700 0300 5549 2937',
        'BIC: HYPTAT22'
      ],
      [
        'UID Nr.: ATU 82406139',
        'Firmenbuch: FN 491554z',
        'Landesgericht Innsbruck',
        'Inhaber: Ing. Andreas Kohlreiter'
      ]
    ];

    const footerFontSize = 6;
    const lineHeight = 3;
    const footerTop = pageHeight - 28;
    const columnGap = 6;
    const colWidth = (pageWidth - margin * 2 - columnGap * 3) / 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(footerFontSize);
    doc.setTextColor(60, 60, 60);

    footerLines.forEach((col, colIndex) => {
      const x = margin + colIndex * (colWidth + columnGap);
      col.forEach((line, lineIndex) => {
        doc.text(line, x, footerTop + lineHeight * lineIndex);
      });
    });
  };

  const drawHeaderLogo = (scale = 1) => {
    if (!headerLogoDataUrl || !headerLogoSize) {
      return;
    }

    const mmPerPx = 25.4 / 96;
    const logoWidth = headerLogoSize.width * mmPerPx * scale;
    const logoHeight = headerLogoSize.height * mmPerPx * scale;
    const logoX = pageWidth - margin - logoWidth;
    const logoY = 6;
    doc.addImage(headerLogoDataUrl, 'PNG', logoX, logoY, logoWidth, logoHeight);
  };

  // --- PAGE 1: TITLE & DISTRIBUTION ---
  doc.setFillColor(31, 41, 55); 
  doc.rect(0, 0, pageWidth, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('Begehungsprotokoll', margin, 18);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('gem. BauKG, BGBI. I Nr. 37/1999', margin, 28);
  drawHeaderLogo();
  // centerText(report.projectName || 'Unnamed Project', 28, 14, 'normal');
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Protokoll lfd. Nr.: ${report.reportNumber || 'N/A'}`, 60, 50);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Bauvorhaben: ${report.projectName || 'N/A'}`, margin, 44);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Dok. Nr.: ${report.projectNumber || 'N/A'}`, margin, 50);
  doc.text(`Datum: ${report.visitDate}`, margin, 56);
  doc.text(`Zeit: ${report.visitTime || 'N/A'}`, 60, 56);
  doc.text(`Ort: ${report.location || 'N/A'}`, margin, 62);
  doc.text(`Verfasser: ${report.author || 'N/A'}`, margin, 68);
  doc.text(`Leiter: ${report.inspector || 'N/A'}`, 60, 68);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Begehung im Sinne des BauKG', margin, 80);
  
  autoTable(doc, {
    startY: 85,
    head: [['Funktion', 'Name', 'Firma', 'Email', 'Anwesend']],
    body: report.distributionList.map(d => [
      d.role, 
      d.name, 
      d.company, 
      d.email, 
      d.isPresent ? '[X] Ja' : '[ ] Nein'
    ]),
    theme: 'grid',
    headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255] },
    columnStyles: {
      4: { halign: 'center' }
    },
    margin: { left: margin, right: margin, bottom: 45 }
  });

  const afterTablePage = doc.getNumberOfPages();
  doc.setPage(1);
  drawFirstPageFooter();
  doc.setPage(afterTablePage);

  // --- PAGE 2+: DEVIATIONS ---
  if (report.deviations.length > 0) {
    doc.addPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Begehung', margin, 20);
    
    let currentY = 30;
    const lineHeight = 5.5;

    for (let i = 0; i < report.deviations.length; i++) {
      const dev = report.deviations[i];
      
      // Approximate height calculation for page break check
      const textWidthLimit = dev.photoUrl ? 90 : 180;
      const splitText = doc.splitTextToSize(dev.textModule || 'No description provided.', textWidthLimit);
      const textBlockHeight = splitText.length * 5;
      const totalItemHeight = Math.max(dev.photoUrl ? 65 : 0, textBlockHeight + 25);

      // Page break check
      if (currentY + totalItemHeight > pageHeight - 20) {
        doc.addPage();
        currentY = 20;
      }

      // Severity Header Bar
      const severityColors: Record<string, [number, number, number]> = {
        'Gruen': [34, 197, 94], 'Rot': [239, 68, 68]
      };
      const color = severityColors[dev.severity] || [100, 100, 100];
      doc.setFillColor(color[0], color[1], color[2]);
      doc.rect(margin, currentY, 180, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.text(`Punkt ${i + 1} - ${dev.severity.toUpperCase()}`, margin + 5, currentY + 5.5);
      doc.setTextColor(0, 0, 0);
      currentY += 12;

      let contentStartY = currentY;
      let textX = margin;
      
      if (dev.photoUrl) {
        try {
          doc.addImage(dev.photoUrl, 'JPEG', margin, currentY, 80, 60);
          textX = margin + 85;
        } catch (e) {
          doc.rect(margin, currentY, 80, 60);
          doc.text('Image Error', margin + 30, currentY + 30);
          textX = margin + 85;
        }
      }

      // Observation Text
      doc.setFont('helvetica', 'bold');
      doc.text('Stichwort/Text:', textX, contentStartY + 5);
      doc.setFont('helvetica', 'normal');
      doc.text(splitText, textX, contentStartY + 11);

      // Track how far down the text went
      const textEndPointY = contentStartY + 11 + (splitText.length * 5);
      // Track how far down the image went (if any)
      const imageEndPointY = dev.photoUrl ? contentStartY + 60 : contentStartY + 11 + (splitText.length * 5);
      
      // Position the metadata fields below both text and image
      // let fieldY = Math.max(textEndPointY, imageEndPointY) + 8;
      let fieldY = textEndPointY + 8;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`Verantwortlich:`, textX, fieldY);
      doc.setFont('helvetica', 'normal');
      doc.text(dev.responsible || 'N/A', textX + 30, fieldY);

      doc.setFont('helvetica', 'bold');
      doc.text(`erledigen / Entscheid:`, textX, fieldY + 6);
      doc.setFont('helvetica', 'normal');
      doc.text(dev.actionStatus || 'laufend', textX + 40, fieldY + 6);

      // Update currentY for next item
      let newfieldY = Math.max(textEndPointY, imageEndPointY) + 8;
      currentY = newfieldY + 15;
    }
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    if (i > 1) {
      drawHeaderLogo(0.5);
    }
    doc.text(`Seite ${i} von ${pageCount}`, pageWidth - 30, pageHeight - 10);
    doc.text(`Bericht erstellt: ${new Date().toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${new Date().toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`, margin, pageHeight - 10);
  }

  const fileName = `${report.visitDate}_Begehung_${report.projectName.replace(/\s+/g, '_') || 'Draft'}.pdf`;
  doc.save(fileName);
};
