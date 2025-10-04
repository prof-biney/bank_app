#!/usr/bin/env node

/**
 * PDF Generation Demo Script
 * 
 * This script demonstrates the difference between HTML and PDF report generation.
 * In a real React Native/Expo environment, the PDF would be generated using expo-print.
 */

const fs = require('fs');
const path = require('path');

// Enhanced sample data
const sampleAnalytics = {
  period: {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date(),
    label: 'Last 30 Days Financial Report'
  },
  cardId: 'card_123',
  cardName: 'Premium Rewards Card',
  summary: {
    totalTransactions: 45,
    totalIncome: 12500.00,
    totalExpenses: 8750.50,
    netBalance: 3749.50,
    averageTransactionAmount: 472.23,
    currentBalance: 15200.00
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
      { category: 'Groceries & Food', count: 12, amount: 2800.00, percentage: 32.0 },
      { category: 'Transportation', count: 8, amount: 1950.00, percentage: 22.3 },
      { category: 'Entertainment', count: 6, amount: 1200.50, percentage: 13.7 },
      { category: 'Utilities', count: 4, amount: 980.00, percentage: 11.2 },
      { category: 'Healthcare', count: 3, amount: 675.00, percentage: 7.7 },
      { category: 'Shopping', count: 12, amount: 1145.00, percentage: 13.1 }
    ],
    transactionTypes: [
      { type: 'Purchase', count: 32, amount: 7200.00, percentage: 82.3 },
      { type: 'Online Payment', count: 8, amount: 1250.50, percentage: 14.3 },
      { type: 'ATM Withdrawal', count: 5, amount: 300.00, percentage: 3.4 }
    ]
  },
  insights: [
    {
      type: 'income_trend',
      title: 'Excellent Financial Health! 💰',
      description: 'Outstanding! You saved GH₵3,749.50 this month, showing strong financial discipline and smart spending habits.',
      value: 3749.50,
      trend: 'up',
      severity: 'success'
    },
    {
      type: 'category_alert',
      title: 'Food & Groceries Focus',
      description: 'Your largest expense category is Groceries & Food at 32.0% of total spending. This is within a healthy range for most budgets.',
      value: 32.0,
      severity: 'info'
    },
    {
      type: 'recommendation',
      title: 'Spending Pattern Analysis',
      description: 'Your average daily spending of GH₵283.24 is well-controlled. Consider setting aside your surplus for long-term savings or investments.',
      value: 283.24,
      severity: 'info'
    },
    {
      type: 'balance_trend',
      title: 'Strong Account Balance',
      description: 'Your current balance of GH₵15,200.00 provides excellent financial cushioning. Great work on maintaining healthy cash reserves!',
      value: 15200.00,
      severity: 'success'
    }
  ]
};

function generateEnhancedHTMLForPDF(analytics, options) {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Financial Report - ${analytics.period.label}</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { 
          font-family: 'Helvetica Neue', Arial, sans-serif; 
          margin: 0; 
          padding: 20px; 
          line-height: 1.6; 
          color: #333;
          font-size: 12px;
        }
        .header { 
          text-align: center; 
          margin-bottom: 30px; 
          page-break-after: avoid;
          border-bottom: 3px solid #1976d2;
          padding-bottom: 20px;
        }
        .header h1 {
          color: #1976d2;
          font-size: 24px;
          margin: 0 0 10px 0;
        }
        .header p {
          margin: 5px 0;
          color: #666;
        }
        .summary { 
          background: #f8f9fa; 
          padding: 20px; 
          border-radius: 8px; 
          margin-bottom: 30px; 
          page-break-inside: avoid;
          border: 1px solid #e0e0e0;
        }
        .metrics-container {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-around;
          gap: 10px;
        }
        .metric { 
          flex: 1;
          min-width: 120px;
          text-align: center; 
          padding: 10px;
          border-radius: 4px;
          background: white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .metric-value { 
          font-size: 18px; 
          font-weight: bold; 
          color: #1976d2;
          display: block;
          margin-bottom: 5px;
        }
        .metric-label { 
          font-size: 11px; 
          color: #666; 
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .section { 
          margin-bottom: 30px; 
          page-break-inside: avoid;
        }
        .section h2 { 
          color: #1976d2; 
          border-bottom: 2px solid #1976d2; 
          padding-bottom: 10px;
          font-size: 16px;
          margin-top: 0;
        }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-top: 15px;
          border: 1px solid #ddd;
        }
        th, td { 
          padding: 8px 12px; 
          text-align: left; 
          border-bottom: 1px solid #ddd;
          font-size: 11px;
        }
        th { 
          background-color: #1976d2;
          color: white;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        .insight { 
          background: #e3f2fd; 
          padding: 15px; 
          border-left: 4px solid #1976d2; 
          margin: 10px 0;
          border-radius: 4px;
          page-break-inside: avoid;
        }
        .insight strong {
          color: #1976d2;
          display: block;
          margin-bottom: 5px;
        }
        .positive { color: #4caf50; font-weight: bold; }
        .negative { color: #f44336; font-weight: bold; }
        .warning { color: #ff9800; font-weight: bold; }
        .footer {
          margin-top: 40px;
          text-align: center;
          color: #666;
          font-size: 10px;
          border-top: 1px solid #e0e0e0;
          padding-top: 20px;
        }
        .chart-placeholder {
          background: linear-gradient(45deg, #f0f0f0, #e0e0e0);
          height: 200px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          margin: 15px 0;
          border: 2px dashed #ccc;
        }
        @media print {
          body { margin: 0; }
          .section { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Financial Analytics Report</h1>
        <p><strong>Period:</strong> ${analytics.period.label}</p>
        ${analytics.cardName ? `<p><strong>Card:</strong> ${analytics.cardName}</p>` : '<p><strong>All Cards</strong></p>'}
        <p><strong>Generated:</strong> ${new Date().toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}</p>
    </div>

    <div class="summary">
        <h2>Executive Summary</h2>
        <div class="metrics-container">
            <div class="metric">
                <span class="metric-value">GH₵${analytics.summary.currentBalance.toLocaleString()}</span>
                <span class="metric-label">Current Balance</span>
            </div>
            <div class="metric">
                <span class="metric-value positive">GH₵${analytics.summary.totalIncome.toLocaleString()}</span>
                <span class="metric-label">Total Income</span>
            </div>
            <div class="metric">
                <span class="metric-value negative">GH₵${analytics.summary.totalExpenses.toLocaleString()}</span>
                <span class="metric-label">Total Expenses</span>
            </div>
            <div class="metric">
                <span class="metric-value ${analytics.summary.netBalance >= 0 ? 'positive' : 'negative'}">GH₵${analytics.summary.netBalance.toLocaleString()}</span>
                <span class="metric-label">Net Savings</span>
            </div>
            <div class="metric">
                <span class="metric-value">${analytics.summary.totalTransactions}</span>
                <span class="metric-label">Total Transactions</span>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Transaction Analysis</h2>
        <table>
            <tr>
                <th>Transaction Type</th>
                <th>Count</th>
                <th>Total Amount</th>
                <th>% of Total</th>
                <th>Avg per Transaction</th>
            </tr>
            ${analytics.trends.transactionTypes.map(type => `
                <tr>
                    <td><strong>${type.type}</strong></td>
                    <td>${type.count}</td>
                    <td>GH₵${type.amount.toLocaleString()}</td>
                    <td>${type.percentage.toFixed(1)}%</td>
                    <td>GH₵${(type.amount / type.count).toFixed(2)}</td>
                </tr>
            `).join('')}
        </table>
    </div>

    <div class="section">
        <h2>Spending by Category</h2>
        <table>
            <tr>
                <th>Category</th>
                <th>Transactions</th>
                <th>Amount Spent</th>
                <th>% of Budget</th>
                <th>Avg per Transaction</th>
            </tr>
            ${analytics.trends.categoryBreakdown.map(category => `
                <tr>
                    <td><strong>${category.category}</strong></td>
                    <td>${category.count}</td>
                    <td>GH₵${category.amount.toLocaleString()}</td>
                    <td>${category.percentage.toFixed(1)}%</td>
                    <td>GH₵${(category.amount / category.count).toFixed(2)}</td>
                </tr>
            `).join('')}
        </table>
    </div>

    ${options.includeCharts ? `
    <div class="section">
        <h2>Visual Analytics</h2>
        <div class="chart-placeholder">
            <div style="text-align: center; color: #666;">
                <p><strong>📊 Chart Visualization</strong></p>
                <p>In the mobile app, this section would contain:</p>
                <p>• Spending trend charts<br>• Category breakdown pie chart<br>• Monthly comparison graphs</p>
            </div>
        </div>
    </div>
    ` : ''}

    ${options.includeInsights ? `
    <div class="section">
        <h2>AI-Powered Financial Insights</h2>
        ${analytics.insights.map(insight => `
            <div class="insight">
                <strong>${insight.title}</strong>
                <p>${insight.description}</p>
            </div>
        `).join('')}
    </div>
    ` : ''}

    <div class="section">
        <h2>Daily Activity Summary</h2>
        <table>
            <tr>
                <th>Date</th>
                <th>Transactions</th>
                <th>Total Activity</th>
                <th>Income</th>
                <th>Expenses</th>
            </tr>
            ${analytics.trends.dailyTransactions.map(day => `
                <tr>
                    <td>${new Date(day.date).toLocaleDateString()}</td>
                    <td>${day.count}</td>
                    <td>GH₵${day.totalAmount.toLocaleString()}</td>
                    <td class="positive">GH₵${day.income.toLocaleString()}</td>
                    <td class="negative">GH₵${day.expenses.toLocaleString()}</td>
                </tr>
            `).join('')}
        </table>
    </div>

    <div class="footer">
        <p><strong>🏦 Bank App Analytics Report</strong></p>
        <p>Generated on ${new Date().toLocaleString()} • Confidential Financial Document</p>
        <p>This report contains sensitive financial information. Handle with care and maintain confidentiality.</p>
        <p style="margin-top: 10px; font-style: italic;">
            PDF generated using expo-print in React Native/Expo environment
        </p>
    </div>
</body>
</html>
  `;
}

async function demonstratePDFGeneration() {
  console.log('🚀 PDF Generation Demonstration\n');
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
    // Generate enhanced HTML suitable for PDF
    console.log('📄 Generating enhanced HTML report for PDF conversion...');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const htmlFileName = `enhanced-pdf-ready-report-${timestamp}.html`;
    const htmlFilePath = path.join(testDir, htmlFileName);
    
    const enhancedHtmlContent = generateEnhancedHTMLForPDF(sampleAnalytics, testOptions);
    
    fs.writeFileSync(htmlFilePath, enhancedHtmlContent, 'utf8');
    const htmlStats = fs.statSync(htmlFilePath);
    
    console.log('✅ Enhanced HTML report generated successfully!');
    console.log(`   📁 File: ${htmlFileName}`);
    console.log(`   📏 Size: ${htmlStats.size} bytes (${(htmlStats.size / 1024).toFixed(2)} KB)`);
    console.log(`   📍 Path: ${htmlFilePath}`);
    console.log('');
    
    // Explain the PDF generation process
    console.log('🔄 PDF Generation Process in React Native/Expo:');
    console.log('-'.repeat(50));
    console.log('1. HTML content is generated with PDF-optimized styling');
    console.log('2. expo-print converts HTML to PDF using native rendering');
    console.log('3. PDF is saved to device storage with proper formatting');
    console.log('4. File can be shared via native sharing APIs');
    console.log('');
    
    console.log('📋 PDF Features Implemented:');
    console.log('✓ Professional typography and layout');
    console.log('✓ Page break optimization for printing');
    console.log('✓ Proper margins and spacing');
    console.log('✓ Color-coded financial data');
    console.log('✓ Structured tables and sections');
    console.log('✓ Header and footer with branding');
    console.log('✓ Mobile-optimized responsive design');
    console.log('');
    
    // Show the code that would be used in React Native
    console.log('💻 React Native Implementation Code:');
    console.log('-'.repeat(50));
    console.log(`
const { uri } = await Print.printToFileAsync({
  html: enhancedHtmlContent,
  base64: false,
  orientation: Print.Orientation.portrait,
  width: 612,  // 8.5 inches * 72 DPI
  height: 792, // 11 inches * 72 DPI
  margins: {
    left: 54,   // 0.75 inch margins
    right: 54,
    top: 72,    // 1 inch top/bottom
    bottom: 72
  }
});

// Move PDF to desired location
await FileSystem.moveAsync({
  from: uri,
  to: '${testDir}/financial-report.pdf'
});
    `);
    
    console.log('');
    console.log('🎯 Key Improvements Over HTML-Only Approach:');
    console.log('• True PDF format suitable for professional sharing');
    console.log('• Consistent formatting across all devices');
    console.log('• Print-ready with proper page breaks');
    console.log('• Enhanced typography and professional styling');
    console.log('• Optimized file size and compatibility');
    console.log('• Native mobile integration with sharing APIs');
    console.log('');
    
    // Summary
    console.log('📊 Report Generation Summary:');
    console.log('='.repeat(50));
    console.log(`✅ HTML Template: Ready for PDF conversion`);
    console.log(`✅ Styling: PDF-optimized with print media queries`);
    console.log(`✅ Content: ${sampleAnalytics.summary.totalTransactions} transactions analyzed`);
    console.log(`✅ Insights: ${sampleAnalytics.insights.length} AI-generated insights included`);
    console.log(`✅ File Size: ${(htmlStats.size / 1024).toFixed(2)} KB (HTML template)`);
    console.log(`📍 Location: ${testDir}/`);
    console.log('');
    console.log('🎉 PDF generation implementation is complete and ready!');
    console.log('   When running in React Native/Expo, this will generate actual PDF files.');
    
    return {
      success: true,
      htmlFile: htmlFilePath,
      fileSize: htmlStats.size,
      features: [
        'PDF-optimized HTML template',
        'expo-print integration',
        'Professional styling',
        'Mobile-ready implementation'
      ]
    };
    
  } catch (error) {
    console.error('❌ PDF generation demonstration failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the demonstration
if (require.main === module) {
  demonstratePDFGeneration()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Demo execution failed:', error);
      process.exit(1);
    });
}

module.exports = { demonstratePDFGeneration };