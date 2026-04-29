'use client';

import React, { useState, useCallback } from 'react';
import type { ScrapeResult } from './ScraperPanel';
import { Copy, Check, Download } from 'lucide-react';
import { toast } from 'sonner';

interface JsonViewerProps {
  result: ScrapeResult;
}

function syntaxHighlight(json: string): string {
  return json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (match) => {
        let cls = 'json-number';
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'json-key';
          } else {
            cls = 'json-string';
          }
        } else if (/true|false/.test(match)) {
          cls = 'json-boolean';
        } else if (/null/.test(match)) {
          cls = 'json-null';
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
}

function toCsv(result: ScrapeResult): string {
  const headers = [
    'asin',
    'url',
    'scraped_at',
    'duration_ms',
    'retried',
    'price',
    'price_raw',
    'list_price',
    'list_price_raw',
    'discount_percent',
    'deal_badge',
    'prime_available',
    'brand',
    'category',
    'categories',
    'image_count',
    'bullet_points',
    'product_description',
    'a_plus_content',
    'availability',
    'availability_status',
    'delivery_estimate',
    'delivery_date',
    'rating',
    'review_count',
    'title',
    'seller',
  ];

  const values = [
    result.asin,
    result.url,
    result.scrapedAt,
    result.duration,
    result.retried,
    result.data.price ?? '',
    result.data.priceRaw ?? '',
    result.data.listPrice ?? '',
    result.data.listPriceRaw ?? '',
    result.data.discountPercent ?? '',
    result.data.dealBadge ?? '',
    result.data.primeAvailable ? 'true' : 'false',
    result.data.brand ?? '',
    result.data.category ?? '',
    result.data.categories.join(' | '),
    result.data.imageCount,
    result.data.bulletPoints.join(' | '),
    result.data.productDescription ?? '',
    result.data.aPlusContent ? 'true' : 'false',
    result.data.availability ?? '',
    result.data.availabilityStatus,
    result.data.deliveryEstimate ?? '',
    result.data.deliveryDate ?? '',
    result.data.rating ?? '',
    result.data.reviewCount ?? '',
    result.data.title ?? '',
    result.data.seller ?? '',
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`);

  return headers.join(',') + '\n' + values.join(',');
}

export default function JsonViewer({ result }: JsonViewerProps) {
  const [copied, setCopied] = useState(false);
  const [format, setFormat] = useState<'json' | 'csv'>('json');

  const jsonStr = JSON.stringify(result, null, 2);
  const csvStr = toCsv(result);

  const handleCopy = useCallback(async () => {
    const text = format === 'json' ? jsonStr : csvStr;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(`${format.toUpperCase()} copied to clipboard`);
    setTimeout(() => setCopied(false), 2000);
  }, [format, jsonStr, csvStr]);

  const handleDownload = useCallback(() => {
    const content = format === 'json' ? jsonStr : csvStr;
    const mimeType = format === 'json' ? 'application/json' : 'text/csv';
    const ext = format === 'json' ? 'json' : 'csv';
    const filename = `amazon_${result.asin}_${new Date().toISOString().split('T')[0]}.${ext}`;

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);
  }, [format, jsonStr, csvStr, result.asin]);

  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 overflow-hidden fade-in">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-800/60 flex items-center justify-between">
        <div className="flex items-center gap-1 p-0.5 rounded-md bg-slate-800/60 border border-slate-700/40">
          <button
            onClick={() => setFormat('json')}
            className={`px-3 py-1 rounded text-xs font-mono font-medium transition-all duration-150 ${
              format === 'json' ?'bg-slate-700 text-slate-100' :'text-slate-500 hover:text-slate-300'
            }`}
          >
            JSON
          </button>
          <button
            onClick={() => setFormat('csv')}
            className={`px-3 py-1 rounded text-xs font-mono font-medium transition-all duration-150 ${
              format === 'csv' ?'bg-slate-700 text-slate-100' :'text-slate-500 hover:text-slate-300'
            }`}
          >
            CSV
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-slate-700/40 transition-all duration-150 active:scale-95"
          >
            {copied ? (
              <Check size={13} className="text-emerald-400" />
            ) : (
              <Copy size={13} />
            )}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 transition-all duration-150 active:scale-95"
          >
            <Download size={13} />
            Download .{format}
          </button>
        </div>
      </div>

      {/* Content */}
      {format === 'json' ? (
        <div className="p-4 overflow-auto max-h-[460px] scrollbar-thin">
          <pre
            className="text-xs font-mono leading-relaxed whitespace-pre"
            dangerouslySetInnerHTML={{ __html: syntaxHighlight(jsonStr) }}
          />
        </div>
      ) : (
        <div className="p-4 overflow-auto max-h-[460px] scrollbar-thin">
          <pre className="text-xs font-mono text-slate-300 leading-relaxed whitespace-pre">
            {csvStr}
          </pre>
        </div>
      )}

      {/* Footer */}
      <div className="px-5 py-2.5 border-t border-slate-800/60 flex items-center justify-between">
        <p className="text-[11px] font-mono text-slate-600">
          {format === 'json'
            ? `${jsonStr.split('\n').length} lines · ${new Blob([jsonStr]).size} bytes`
            : `2 rows · ${Object.keys(result.data).length + 5} columns`}
        </p>
        <p className="text-[11px] text-slate-600">{result.asin}</p>
      </div>
    </div>
  );
}
