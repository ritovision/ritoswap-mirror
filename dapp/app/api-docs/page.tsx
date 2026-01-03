'use client';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import './css-override.css';

export default function ApiDocs() {
  return (
    <div className="min-h-screen">
      <SwaggerUI url="/api/openapi" />
    </div>
  );
}