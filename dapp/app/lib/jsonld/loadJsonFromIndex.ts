// app/lib/jsonld/loadJsonFromIndex.ts
import React from 'react';

export function loadJsonLdScripts(
  jsonLdArray: unknown[],
  idPrefix = 'jsonld'
): React.ReactElement[] {
  return jsonLdArray.map((jsonLd, idx) =>
    React.createElement('script', {
      key: `${idPrefix}-${idx}`,
      id: `${idPrefix}-${idx}`,
      type: 'application/ld+json',
      strategy: 'beforeInteractive',
      dangerouslySetInnerHTML: { __html: JSON.stringify(jsonLd) },
    })
  );
}
