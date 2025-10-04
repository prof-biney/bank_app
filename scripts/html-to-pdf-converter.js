#!/usr/bin/env node

/**
 * HTML to PDF Converter
 * 
 * This script converts HTML reports to actual PDF files using Puppeteer.
 * This demonstrates the full PDF generation capability that would be 
 * handled by expo-print in the React Native environment.
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

async function convertHTMLToPDF(htmlFilePath, outputPdfPath) {
  let browser;
  
  try {
    console.log('🚀 Starting PDF conversion...');
    console.log(`📄 Input: ${path.basename(htmlFilePath)}`);
    console.log(`📑 Output: ${path.basename(outputPdfPath)}`);
    
    // Launch browser
    console.log('⚙️  Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Read HTML content
    const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
    
    // Set content and wait for load
    console.log('📝 Loading HTML content...');
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    // Set viewport for consistent rendering
    await page.setViewport({ width: 1200, height: 800 });
    
    // Generate PDF with professional settings
    console.log('🔄 Converting to PDF...');
    await page.pdf({
      path: outputPdfPath,
      format: 'A4',
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      },
      printBackground: true,
      displayHeaderFooter: false,
      preferCSSPageSize: false,
    });
    
    // Get file stats
    const stats = fs.statSync(outputPdfPath);
    
    console.log('✅ PDF generated successfully!');
    console.log(`📏 Size: ${stats.size} bytes (${(stats.size / 1024).toFixed(2)} KB)`);
    console.log(`📍 Location: ${outputPdfPath}`);
    
    return {
      success: true,
      filePath: outputPdfPath,
      fileSize: stats.size,
      message: 'PDF generated successfully'
    };
    
  } catch (error) {
    console.error('❌ PDF conversion failed:', error.message);
    return {
      success: false,
      error: error.message,
      message: 'PDF conversion failed'
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function convertAllHTMLReports() {
  console.log('🚀 HTML to PDF Batch Converter\n');
  console.log('='.repeat(50));
  
  const testReportsDir = path.join(__dirname, '../test-reports');
  
  if (!fs.existsSync(testReportsDir)) {
    console.error('❌ Test reports directory not found:', testReportsDir);
    return { success: false, message: 'Test reports directory not found' };
  }
  
  // Find all HTML files in test-reports directory
  const files = fs.readdirSync(testReportsDir);
  const htmlFiles = files.filter(file => file.endsWith('.html'));
  
  if (htmlFiles.length === 0) {
    console.log('⚠️  No HTML files found in test-reports directory');
    return { success: false, message: 'No HTML files to convert' };
  }
  
  console.log(`📁 Found ${htmlFiles.length} HTML file(s) to convert:\n`);
  
  const results = [];
  
  for (const htmlFile of htmlFiles) {
    const htmlFilePath = path.join(testReportsDir, htmlFile);
    const pdfFileName = htmlFile.replace('.html', '.pdf');
    const pdfFilePath = path.join(testReportsDir, pdfFileName);
    
    console.log(`\n📄 Processing: ${htmlFile}`);
    console.log('-'.repeat(40));
    
    const result = await convertHTMLToPDF(htmlFilePath, pdfFilePath);
    results.push({
      htmlFile,
      pdfFile: pdfFileName,
      ...result
    });
    
    if (result.success) {
      console.log(`✅ ${htmlFile} → ${pdfFileName}`);
    } else {
      console.log(`❌ Failed to convert ${htmlFile}: ${result.error}`);
    }
  }
  
  // Summary
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 Conversion Summary:');
  console.log('='.repeat(50));
  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`📁 Total: ${results.length}`);
  
  if (successful.length > 0) {
    console.log('\n🎉 Successfully converted files:');
    successful.forEach(result => {
      console.log(`   📑 ${result.pdfFile} (${(result.fileSize / 1024).toFixed(2)} KB)`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\n❌ Failed conversions:');
    failed.forEach(result => {
      console.log(`   📄 ${result.htmlFile}: ${result.error}`);
    });
  }
  
  // Show final directory contents
  console.log('\n📁 Updated test-reports directory:');
  const finalFiles = fs.readdirSync(testReportsDir);
  finalFiles.forEach(file => {
    const filePath = path.join(testReportsDir, file);
    const stats = fs.statSync(filePath);
    const extension = path.extname(file).toUpperCase().slice(1);
    const sizeKB = (stats.size / 1024).toFixed(2);
    
    let emoji = '📄';
    if (file.endsWith('.pdf')) emoji = '📑';
    else if (file.endsWith('.json')) emoji = '📋';
    else if (file.endsWith('.csv')) emoji = '📊';
    
    console.log(`   ${emoji} ${file} (${extension}, ${sizeKB} KB)`);
  });
  
  return {
    success: successful.length > 0,
    results,
    summary: {
      successful: successful.length,
      failed: failed.length,
      total: results.length
    }
  };
}

// CLI usage
if (require.main === module) {
  // Check if specific files were provided as arguments
  const args = process.argv.slice(2);
  
  if (args.length === 2) {
    // Convert specific HTML to PDF
    const [htmlPath, pdfPath] = args;
    convertHTMLToPDF(htmlPath, pdfPath)
      .then(result => {
        process.exit(result.success ? 0 : 1);
      })
      .catch(error => {
        console.error('❌ Conversion failed:', error);
        process.exit(1);
      });
  } else {
    // Convert all HTML files in test-reports directory
    convertAllHTMLReports()
      .then(result => {
        process.exit(result.success ? 0 : 1);
      })
      .catch(error => {
        console.error('❌ Batch conversion failed:', error);
        process.exit(1);
      });
  }
}

module.exports = {
  convertHTMLToPDF,
  convertAllHTMLReports
};