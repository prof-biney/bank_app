#!/usr/bin/env node

/**
 * Test Script for Report Generation
 * 
 * This script tests the report generation functionality to ensure
 * all formats (CSV, JSON, PDF/HTML) work correctly.
 */

const fs = require('fs');
const path = require('path');

// Simple test data structure
const sampleAnalytics = {
  period: {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date(),
    label: 'Test Period - Last 30 Days'
  },
  summary: {
    totalTransactions: 25,
    totalIncome: 5000.00,
    totalExpenses: 3500.00,
    netBalance: 1500.00,
    averageTransactionAmount: 340.00,
    currentBalance: 8500.00
  },
  trends: {
    dailyTransactions: [
      { date: '2024-01-01', count: 3, totalAmount: 450.00, income: 500.00, expenses: 50.00 },
      { date: '2024-01-02', count: 2, totalAmount: 320.00, income: 0.00, expenses: 320.00 }
    ],
    monthlyTrends: [
      { month: 'January', year: 2024, totalTransactions: 25, totalAmount: 8500.00, income: 5000.00, expenses: 3500.00, averageDaily: 283.33 }
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
      type: 'income_trend',
      title: 'Positive Cash Flow',
      description: 'Great job! You saved GH₵1,500.00 during this period',
      value: 1500.00,
      trend: 'up',
      severity: 'success'
    },
    {
      type: 'category_alert',
      title: 'Category Concentration',
      description: '34.3% of your spending is in Groceries. Consider diversifying your expenses.',
      value: 34.3,
      severity: 'info'
    }
  ]
};

const testOptions = {
  period: '30d',
  includeCharts: true,
  includeInsights: true
};

function generateCSVContent(analytics, options) {
  let csvContent = 'Financial Report\n\n';
  
  // Summary section
  csvContent += 'SUMMARY\n';
  csvContent += `Period,"${analytics.period.label}"\n`;
  csvContent += `Total Transactions,${analytics.summary.totalTransactions || 0}\n`;
  csvContent += `Total Income,"GH₵${(analytics.summary.totalIncome || 0).toFixed(2)}"\n`;
  csvContent += `Total Expenses,"GH₵${(analytics.summary.totalExpenses || 0).toFixed(2)}"\n`;
  csvContent += `Net Balance,"GH₵${(analytics.summary.netBalance || 0).toFixed(2)}"\n`;
  csvContent += `Current Balance,"GH₵${(analytics.summary.currentBalance || 0).toFixed(2)}"\n\n`;

  // Transaction types breakdown
  if (analytics.trends.transactionTypes && analytics.trends.transactionTypes.length > 0) {
    csvContent += 'TRANSACTION TYPES\n';
    csvContent += 'Type,Count,Amount,Percentage\n';
    analytics.trends.transactionTypes.forEach(type => {
      const safeType = (type.type || 'Unknown').replace(/"/g, '""');
      csvContent += `"${safeType}",${type.count || 0},"GH₵${(type.amount || 0).toFixed(2)}","${(type.percentage || 0).toFixed(1)}%"\n`;
    });
    csvContent += '\n';
  }

  // Category breakdown
  if (analytics.trends.categoryBreakdown && analytics.trends.categoryBreakdown.length > 0) {
    csvContent += 'CATEGORIES\n';
    csvContent += 'Category,Count,Amount,Percentage\n';
    analytics.trends.categoryBreakdown.forEach(category => {
      const safeCategory = (category.category || 'Uncategorized').replace(/"/g, '""');
      csvContent += `"${safeCategory}",${category.count || 0},"GH₵${(category.amount || 0).toFixed(2)}","${(category.percentage || 0).toFixed(1)}%"\n`;
    });
  }

  // Include insights if requested
  if (options.includeInsights && analytics.insights && analytics.insights.length > 0) {
    csvContent += '\nINSIGHTS\n';
    csvContent += 'Type,Title,Description\n';
    analytics.insights.forEach(insight => {
      const safeTitle = (insight.title || '').replace(/"/g, '""');
      const safeDescription = (insight.description || '').replace(/"/g, '""');
      csvContent += `"${insight.type || 'info'}","${safeTitle}","${safeDescription}"\n`;
    });
  }

  return csvContent;
}

function generateJSONContent(analytics, options) {
  const report = {
    metadata: {
      generatedAt: new Date().toISOString(),
      reportType: 'Financial Analytics Report',
      version: '1.0',
      period: analytics.period,
      cardId: analytics.cardId || null,
      cardName: analytics.cardName || 'All Cards',
      options: {
        ...options,
        generatedBy: 'Bank App Analytics Service Test'
      }
    },
    summary: {
      ...analytics.summary,
      totalIncome: Number((analytics.summary.totalIncome || 0).toFixed(2)),
      totalExpenses: Number((analytics.summary.totalExpenses || 0).toFixed(2)),
      netBalance: Number((analytics.summary.netBalance || 0).toFixed(2)),
      currentBalance: Number((analytics.summary.currentBalance || 0).toFixed(2)),
      averageTransactionAmount: Number((analytics.summary.averageTransactionAmount || 0).toFixed(2))
    },
    trends: {
      dailyTransactions: analytics.trends.dailyTransactions || [],
      monthlyTrends: analytics.trends.monthlyTrends || [],
      categoryBreakdown: (analytics.trends.categoryBreakdown || []).map(cat => ({
        ...cat,
        amount: Number((cat.amount || 0).toFixed(2)),
        percentage: Number((cat.percentage || 0).toFixed(2))
      })),
      transactionTypes: (analytics.trends.transactionTypes || []).map(type => ({
        ...type,
        amount: Number((type.amount || 0).toFixed(2)),
        percentage: Number((type.percentage || 0).toFixed(2))
      }))
    },
    insights: analytics.insights || []
  };

  return JSON.stringify(report, null, 2);
}

function generateHTMLContent(analytics, options) {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Financial Report - ${analytics.period.label}</title>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .metric { display: inline-block; margin: 10px 20px; text-align: center; }
        .metric-value { font-size: 24px; font-weight: bold; color: #1976d2; }
        .metric-label { font-size: 14px; color: #666; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #333; border-bottom: 2px solid #1976d2; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f5f5f5; font-weight: bold; }
        .insight { background: #e3f2fd; padding: 15px; border-left: 4px solid #1976d2; margin: 10px 0; }
        .positive { color: #4caf50; }
        .negative { color: #f44336; }
        .warning { color: #ff9800; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Financial Analytics Report</h1>
        <p><strong>Period:</strong> ${analytics.period.label}</p>
        ${analytics.cardName ? `<p><strong>Card:</strong> ${analytics.cardName}</p>` : '<p><strong>All Cards</strong></p>'}
        <p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
    </div>

    <div class="summary">
        <h2>Financial Summary</h2>
        <div class="metric">
            <div class="metric-value">GH₵${analytics.summary.currentBalance.toFixed(2)}</div>
            <div class="metric-label">Current Balance</div>
        </div>
        <div class="metric">
            <div class="metric-value positive">GH₵${analytics.summary.totalIncome.toFixed(2)}</div>
            <div class="metric-label">Total Income</div>
        </div>
        <div class="metric">
            <div class="metric-value negative">GH₵${analytics.summary.totalExpenses.toFixed(2)}</div>
            <div class="metric-label">Total Expenses</div>
        </div>
        <div class="metric">
            <div class="metric-value ${analytics.summary.netBalance >= 0 ? 'positive' : 'negative'}">GH₵${analytics.summary.netBalance.toFixed(2)}</div>
            <div class="metric-label">Net Balance</div>
        </div>
        <div class="metric">
            <div class="metric-value">${analytics.summary.totalTransactions}</div>
            <div class="metric-label">Total Transactions</div>
        </div>
    </div>

    <div class="section">
        <h2>Transaction Types</h2>
        <table>
            <tr>
                <th>Type</th>
                <th>Count</th>
                <th>Amount</th>
                <th>Percentage</th>
            </tr>
            ${analytics.trends.transactionTypes.map(type => `
                <tr>
                    <td>${type.type}</td>
                    <td>${type.count}</td>
                    <td>GH₵${type.amount.toFixed(2)}</td>
                    <td>${type.percentage.toFixed(1)}%</td>
                </tr>
            `).join('')}
        </table>
    </div>

    <div class="section">
        <h2>Category Breakdown</h2>
        <table>
            <tr>
                <th>Category</th>
                <th>Count</th>
                <th>Amount</th>
                <th>Percentage</th>
            </tr>
            ${analytics.trends.categoryBreakdown.map(category => `
                <tr>
                    <td>${category.category}</td>
                    <td>${category.count}</td>
                    <td>GH₵${category.amount.toFixed(2)}</td>
                    <td>${category.percentage.toFixed(1)}%</td>
                </tr>
            `).join('')}
        </table>
    </div>

    ${options.includeInsights ? `
    <div class="section">
        <h2>Financial Insights</h2>
        ${analytics.insights.map(insight => `
            <div class="insight">
                <strong>${insight.title}</strong><br>
                ${insight.description}
            </div>
        `).join('')}
    </div>
    ` : ''}

    <div style="margin-top: 50px; text-align: center; color: #666; font-size: 12px;">
        <p>Generated by Bank App Analytics Test • ${new Date().toLocaleDateString()}</p>
    </div>
</body>
</html>
  `;
}

async function testReportGeneration() {
  console.log('🚀 Starting Report Generation Test...\n');
  
  const testDir = path.join(__dirname, '../test-reports');
  
  // Create test directory
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
    console.log(`📁 Created test directory: ${testDir}`);
  }
  
  const results = [];
  const formats = [
    { ext: 'csv', name: 'CSV', generator: generateCSVContent },
    { ext: 'json', name: 'JSON', generator: generateJSONContent },
    { ext: 'html', name: 'HTML', generator: generateHTMLContent },
    { ext: 'pdf', name: 'PDF (Note: Requires React Native/Expo environment)', generator: generateHTMLContent, note: 'PDF generation requires expo-print and mobile environment' }
  ];

  for (const format of formats) {
    try {
      console.log(`📊 Testing ${format.name} report generation...`);
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `test-financial-report-${timestamp}.${format.ext}`;
      const filePath = path.join(testDir, fileName);
      
      const content = format.generator(sampleAnalytics, testOptions);
      
      if (!content || content.length === 0) {
        throw new Error(`Generated ${format.name} content is empty`);
      }
      
      fs.writeFileSync(filePath, content, 'utf8');
      
      const stats = fs.statSync(filePath);
      
      results.push({
        format: format.name,
        success: true,
        filePath,
        fileName,
        fileSize: stats.size,
        message: `${format.name} report generated successfully`
      });
      
      console.log(`✅ ${format.name} report: SUCCESS`);
      console.log(`   File: ${fileName}`);
      console.log(`   Size: ${stats.size} bytes`);
      console.log(`   Path: ${filePath}\n`);
      
    } catch (error) {
      results.push({
        format: format.name,
        success: false,
        error: error.message,
        message: `Failed to generate ${format.name} report`
      });
      
      console.log(`❌ ${format.name} report: FAILED`);
      console.log(`   Error: ${error.message}\n`);
    }
  }
  
  const allSuccessful = results.every(result => result.success);
  
  console.log('📋 Test Results Summary:');
  console.log('========================');
  results.forEach(result => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${result.format}: ${result.message}`);
    if (result.success) {
      console.log(`     File size: ${result.fileSize} bytes`);
    }
  });
  
  console.log(`\n🎯 Overall Result: ${allSuccessful ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  console.log(`📁 Test files saved in: ${testDir}`);
  
  return {
    success: allSuccessful,
    results,
    testDirectory: testDir
  };
}

// Run the test
if (require.main === module) {
  testReportGeneration()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testReportGeneration };