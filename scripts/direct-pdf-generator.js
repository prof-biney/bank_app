#!/usr/bin/env node

/**
 * Direct PDF Generator
 * 
 * This script generates PDF reports directly using PDFKit without HTML conversion.
 * This provides a lightweight, dependency-free solution for PDF generation that
 * works in any Node.js environment. Now with proper currency symbols and HTML-matching layout.
 */

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

// Currency symbol helper - fixes unicode display issues
function formatCurrency(amount, currency = 'GHS') {
  const symbols = {
    'GHS': 'GH¢',  // Use proper cedis symbol instead of unicode
    'USD': '$',
    'EUR': '€',
    'GBP': '£'
  };
  
  const symbol = symbols[currency] || currency;
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Sample data matching the HTML report exactly
const sampleAnalytics = {
  period: {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date(),
    label: 'Test Period - Last 30 Days'
  },
  cardId: 'all_cards',
  cardName: 'All Cards',
  summary: {
    totalTransactions: 25,
    totalIncome: 5000.00,
    totalExpenses: 3500.00,
    netBalance: 1500.00,
    averageTransactionAmount: 140.00,
    currentBalance: 8500.00
  },
  trends: {
    dailyTransactions: [
      { date: '2024-01-01', count: 4, totalAmount: 890.00, income: 1200.00, expenses: 310.00 },
      { date: '2024-01-02', count: 3, totalAmount: 650.00, income: 0.00, expenses: 650.00 },
      { date: '2024-01-03', count: 2, totalAmount: 1200.00, income: 1200.00, expenses: 0.00 },
      { date: '2024-01-04', count: 5, totalAmount: 420.75, income: 0.00, expenses: 420.75 },
      { date: '2024-01-05', count: 1, totalAmount: 85.00, income: 0.00, expenses: 85.00 }
    ],
    monthlyTrends: [
      { 
        month: 'January', 
        year: 2024, 
        totalTransactions: 45, 
        totalAmount: 21250.50, 
        income: 12500.00, 
        expenses: 8750.50, 
        averageDaily: 685.18 
      }
    ],
    categoryBreakdown: [
      { category: 'Groceries', count: 8, amount: 1200.00, percentage: 34.3 },
      { category: 'Transportation', count: 5, amount: 800.00, percentage: 22.9 },
      { category: 'Entertainment', count: 3, amount: 450.00, percentage: 12.9 }
    ],
    transactionTypes: [
      { type: 'Purchase', count: 18, amount: 3200.00, percentage: 91.4 },
      { type: 'Withdrawal', count: 2, amount: 300.00, percentage: 8.6 }
    ]
  },
  insights: [
    {
      type: 'positive_cashflow',
      title: 'Positive Cash Flow',
      description: 'Great job! You saved GH₵1,500.00 during this period',
      value: 1500.00,
      trend: 'up',
      severity: 'success'
    },
    {
      type: 'category_concentration',
      title: 'Category Concentration',
      description: '34.3% of your spending is in Groceries. Consider diversifying your expenses.',
      value: 34.3,
      severity: 'info'
    }
  ]
};

class PDFReportGenerator {
  constructor() {
    this.pageWidth = 595; // A4 width in points
    this.pageHeight = 842; // A4 height in points
    this.margin = 50;
    this.contentWidth = this.pageWidth - (this.margin * 2);
    
    // Colors
    this.colors = {
      primary: '#1976d2',
      success: '#4caf50',
      error: '#f44336',
      warning: '#ff9800',
      text: '#333333',
      lightGray: '#f5f5f5',
      darkGray: '#666666'
    };
  }

  async generatePDF(analytics, options, outputPath) {
    return new Promise((resolve, reject) => {
      try {
        console.log('🚀 Starting direct PDF generation...');
        console.log(`📄 Analytics data: ${analytics.summary.totalTransactions} transactions`);
        console.log(`📑 Output: ${path.basename(outputPath)}`);
        
        // Create PDF document
        const doc = new PDFDocument({
          size: 'A4',
          margins: {
            top: this.margin,
            bottom: this.margin,
            left: this.margin,
            right: this.margin
          },
          info: {
            Title: 'Financial Analytics Report',
            Author: 'Bank App Analytics',
            Subject: `Financial Report - ${analytics.period.label}`,
            Keywords: 'financial report analytics banking',
            CreationDate: new Date(),
            ModificationDate: new Date()
          }
        });

        // Create write stream
        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

        let currentY = this.margin;

        // Generate report sections
        currentY = this.addHeader(doc, analytics, currentY);
        currentY = this.addExecutiveSummary(doc, analytics, currentY);
        currentY = this.addTransactionAnalysis(doc, analytics, currentY);
        currentY = this.addCategoryBreakdown(doc, analytics, currentY);
        
        if (options.includeInsights && analytics.insights.length > 0) {
          currentY = this.addInsights(doc, analytics, currentY);
        }
        
        currentY = this.addDailyActivity(doc, analytics, currentY);
        this.addFooter(doc);

        // Finalize PDF
        doc.end();

        stream.on('finish', () => {
          const stats = fs.statSync(outputPath);
          console.log('✅ PDF generated successfully!');
          console.log(`📏 Size: ${stats.size} bytes (${(stats.size / 1024).toFixed(2)} KB)`);
          console.log(`📍 Location: ${outputPath}`);
          
          resolve({
            success: true,
            filePath: outputPath,
            fileSize: stats.size,
            message: 'PDF generated successfully using direct generation'
          });
        });

        stream.on('error', (error) => {
          console.error('❌ PDF generation failed:', error.message);
          reject({
            success: false,
            error: error.message,
            message: 'PDF generation failed'
          });
        });

      } catch (error) {
        console.error('❌ PDF generation failed:', error.message);
        reject({
          success: false,
          error: error.message,
          message: 'PDF generation failed'
        });
      }
    });
  }

  addHeader(doc, analytics, y) {
    // Header background
    doc.rect(0, 0, this.pageWidth, 80)
       .fill(this.colors.primary);

    // Title
    doc.fillColor('white')
       .fontSize(24)
       .font('Helvetica-Bold')
       .text('Financial Analytics Report', this.margin, 25, { width: this.contentWidth, align: 'center' });

    // Subtitle
    doc.fontSize(12)
       .font('Helvetica')
       .text(`${analytics.period.label} | ${analytics.cardName || 'All Cards'}`, this.margin, 50, { 
         width: this.contentWidth, 
         align: 'center' 
       });

    doc.fontSize(10)
       .text(`Generated on ${new Date().toLocaleDateString('en-US', { 
         weekday: 'long', 
         year: 'numeric', 
         month: 'long', 
         day: 'numeric' 
       })}`, this.margin, 65, { width: this.contentWidth, align: 'center' });

    return 100; // Return new Y position
  }

  addExecutiveSummary(doc, analytics, y) {
    // Section title
    y = this.addSectionTitle(doc, 'Executive Summary', y + 20);
    
    // Metrics in a grid
    const metrics = [
      { label: 'Current Balance', value: formatCurrency(analytics.summary.currentBalance), color: this.colors.primary },
      { label: 'Total Income', value: formatCurrency(analytics.summary.totalIncome), color: this.colors.success },
      { label: 'Total Expenses', value: formatCurrency(analytics.summary.totalExpenses), color: this.colors.error },
      { label: 'Net Balance', value: formatCurrency(analytics.summary.netBalance), color: analytics.summary.netBalance >= 0 ? this.colors.success : this.colors.error },
      { label: 'Transactions', value: analytics.summary.totalTransactions.toString(), color: this.colors.text },
      { label: 'Average/Transaction', value: formatCurrency(analytics.summary.averageTransactionAmount), color: this.colors.text }
    ];

    const cols = 3;
    const rows = Math.ceil(metrics.length / cols);
    const boxWidth = this.contentWidth / cols - 10;
    const boxHeight = 60;

    for (let i = 0; i < metrics.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = this.margin + (col * (boxWidth + 15));
      const boxY = y + (row * (boxHeight + 10));

      // Box background
      doc.rect(x, boxY, boxWidth, boxHeight)
         .fill(this.colors.lightGray)
         .stroke(this.colors.darkGray);

      // Metric value
      doc.fillColor(metrics[i].color)
         .fontSize(16)
         .font('Helvetica-Bold')
         .text(metrics[i].value, x + 5, boxY + 15, { width: boxWidth - 10, align: 'center' });

      // Metric label
      doc.fillColor(this.colors.darkGray)
         .fontSize(10)
         .font('Helvetica')
         .text(metrics[i].label, x + 5, boxY + 35, { width: boxWidth - 10, align: 'center' });
    }

    return y + (rows * 70) + 20;
  }

  addTransactionAnalysis(doc, analytics, y) {
    // Check if we need a new page
    if (y > this.pageHeight - 200) {
      doc.addPage();
      y = this.margin;
    }

    y = this.addSectionTitle(doc, 'Transaction Analysis', y);
    
    // Table header
    const tableY = y + 10;
    const colWidths = [120, 60, 100, 80, 100];
    const headers = ['Transaction Type', 'Count', 'Total Amount', '% of Total', 'Avg/Transaction'];
    
    y = this.addTableHeader(doc, headers, colWidths, tableY);
    
    // Table rows
    analytics.trends.transactionTypes.forEach((type, index) => {
      const rowData = [
        type.type,
        type.count.toString(),
        formatCurrency(type.amount),
        `${type.percentage.toFixed(1)}%`,
        formatCurrency(type.amount / type.count)
      ];
      
      y = this.addTableRow(doc, rowData, colWidths, y, index % 2 === 0);
    });

    return y + 20;
  }

  addCategoryBreakdown(doc, analytics, y) {
    // Check if we need a new page
    if (y > this.pageHeight - 250) {
      doc.addPage();
      y = this.margin;
    }

    y = this.addSectionTitle(doc, 'Spending by Category', y);
    
    // Table header
    const tableY = y + 10;
    const colWidths = [120, 80, 100, 80, 100];
    const headers = ['Category', 'Transactions', 'Amount Spent', '% of Budget', 'Avg/Transaction'];
    
    y = this.addTableHeader(doc, headers, colWidths, tableY);
    
    // Table rows
    analytics.trends.categoryBreakdown.forEach((category, index) => {
      const rowData = [
        category.category,
        category.count.toString(),
        formatCurrency(category.amount),
        `${category.percentage.toFixed(1)}%`,
        formatCurrency(category.amount / category.count)
      ];
      
      y = this.addTableRow(doc, rowData, colWidths, y, index % 2 === 0);
    });

    return y + 20;
  }

  addInsights(doc, analytics, y) {
    // Check if we need a new page
    if (y > this.pageHeight - 200) {
      doc.addPage();
      y = this.margin;
    }

    y = this.addSectionTitle(doc, 'AI-Powered Financial Insights', y);
    
    analytics.insights.forEach(insight => {
      // Insight box
      const boxHeight = 50;
      
      // Color based on severity
      let borderColor = this.colors.primary;
      if (insight.severity === 'success') borderColor = this.colors.success;
      else if (insight.severity === 'warning') borderColor = this.colors.warning;
      
      doc.rect(this.margin, y, this.contentWidth, boxHeight)
         .fill(this.colors.lightGray)
         .stroke(borderColor);
      
      // Left border accent
      doc.rect(this.margin, y, 4, boxHeight).fill(borderColor);
      
      // Insight title
      doc.fillColor(borderColor)
         .fontSize(12)
         .font('Helvetica-Bold')
         .text(insight.title, this.margin + 15, y + 10, { width: this.contentWidth - 30 });
      
      // Insight description
      doc.fillColor(this.colors.text)
         .fontSize(10)
         .font('Helvetica')
         .text(insight.description, this.margin + 15, y + 25, { width: this.contentWidth - 30 });
      
      y += boxHeight + 10;
    });

    return y + 10;
  }

  addDailyActivity(doc, analytics, y) {
    // Check if we need a new page
    if (y > this.pageHeight - 200) {
      doc.addPage();
      y = this.margin;
    }

    y = this.addSectionTitle(doc, 'Daily Activity Summary (Last 5 Days)', y);
    
    // Table header
    const tableY = y + 10;
    const colWidths = [100, 80, 100, 100, 100];
    const headers = ['Date', 'Transactions', 'Total Activity', 'Income', 'Expenses'];
    
    y = this.addTableHeader(doc, headers, colWidths, tableY);
    
    // Table rows (show only last 5 days for space)
    const recentDays = analytics.trends.dailyTransactions.slice(-5);
    recentDays.forEach((day, index) => {
      const rowData = [
        new Date(day.date).toLocaleDateString(),
        day.count.toString(),
        `GH₵${day.totalAmount.toLocaleString()}`,
        `GH₵${day.income.toLocaleString()}`,
        `GH₵${day.expenses.toLocaleString()}`
      ];
      
      y = this.addTableRow(doc, rowData, colWidths, y, index % 2 === 0);
    });

    return y + 20;
  }

  addSectionTitle(doc, title, y) {
    doc.fillColor(this.colors.primary)
       .fontSize(16)
       .font('Helvetica-Bold')
       .text(title, this.margin, y);
    
    // Underline
    doc.moveTo(this.margin, y + 18)
       .lineTo(this.margin + 200, y + 18)
       .strokeColor(this.colors.primary)
       .stroke();
    
    return y + 30;
  }

  addTableHeader(doc, headers, colWidths, y) {
    let x = this.margin;
    
    headers.forEach((header, index) => {
      doc.rect(x, y, colWidths[index], 25)
         .fill(this.colors.primary);
      
      doc.fillColor('white')
         .fontSize(10)
         .font('Helvetica-Bold')
         .text(header, x + 5, y + 8, { width: colWidths[index] - 10, align: 'left' });
      
      x += colWidths[index];
    });
    
    return y + 25;
  }

  addTableRow(doc, rowData, colWidths, y, isEven = false) {
    let x = this.margin;
    const rowHeight = 20;
    
    // Row background
    if (isEven) {
      doc.rect(this.margin, y, this.contentWidth, rowHeight)
         .fill('#f9f9f9');
    }
    
    rowData.forEach((data, index) => {
      doc.rect(x, y, colWidths[index], rowHeight)
         .stroke(this.colors.darkGray);
      
      doc.fillColor(this.colors.text)
         .fontSize(9)
         .font('Helvetica')
         .text(data, x + 5, y + 6, { width: colWidths[index] - 10, align: 'left' });
      
      x += colWidths[index];
    });
    
    return y + rowHeight;
  }

  addFooter(doc) {
    const footerY = this.pageHeight - 40;
    
    doc.fillColor(this.colors.darkGray)
       .fontSize(8)
       .font('Helvetica')
       .text('🏦 Bank App Analytics Report • Confidential Financial Document', 
             this.margin, footerY, { width: this.contentWidth, align: 'center' });
    
    doc.text('Generated using direct PDF generation • Handle with care and maintain confidentiality', 
             this.margin, footerY + 12, { width: this.contentWidth, align: 'center' });
  }
}

async function generateDirectPDF() {
  console.log('🚀 Direct PDF Generation Demo\n');
  console.log('='.repeat(50));
  
  const testDir = path.join(__dirname, '../test-reports');
  
  // Create test directory if it doesn't exist
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  const testOptions = {
    period: '30d',
    includeCharts: true,
    includeInsights: true
  };

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const pdfFileName = `direct-pdf-report-${timestamp}.pdf`;
    const pdfFilePath = path.join(testDir, pdfFileName);
    
    const generator = new PDFReportGenerator();
    const result = await generator.generatePDF(sampleAnalytics, testOptions, pdfFilePath);
    
    console.log('\n🎉 Direct PDF Generation Complete!');
    console.log('='.repeat(50));
    console.log('✅ Method: Direct PDF creation using PDFKit');
    console.log('✅ No HTML conversion required');
    console.log('✅ No browser dependencies');
    console.log('✅ Lightweight and fast generation');
    console.log('✅ Professional formatting and styling');
    
    // Show final directory contents
    console.log('\n📁 Updated test-reports directory:');
    const files = fs.readdirSync(testDir);
    files.forEach(file => {
      const filePath = path.join(testDir, file);
      const stats = fs.statSync(filePath);
      const extension = path.extname(file).toUpperCase().slice(1);
      const sizeKB = (stats.size / 1024).toFixed(2);
      
      let emoji = '📄';
      if (file.endsWith('.pdf')) emoji = '📑';
      else if (file.endsWith('.json')) emoji = '📋';
      else if (file.endsWith('.csv')) emoji = '📊';
      
      const isNew = file === pdfFileName;
      console.log(`   ${emoji} ${file} (${extension}, ${sizeKB} KB)${isNew ? ' ⭐ NEW!' : ''}`);
    });
    
    return result;
    
  } catch (error) {
    console.error('❌ Direct PDF generation failed:', error);
    return {
      success: false,
      error: error.message || error
    };
  }
}

// CLI usage
if (require.main === module) {
  generateDirectPDF()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Generation failed:', error);
      process.exit(1);
    });
}

module.exports = {
  PDFReportGenerator,
  generateDirectPDF
};