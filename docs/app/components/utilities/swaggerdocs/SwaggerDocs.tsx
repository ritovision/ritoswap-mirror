import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import './css-override.css';

const apiBaseUrl =
  process.env.NEXT_PUBLIC_LOCAL_DOCS === 'true'
    ? 'http://localhost:3000'
    : 'https://ritoswap.com';

type SwaggerDocsProps = {
  tag?: string;
};

export default function SwaggerDocs({ tag }: SwaggerDocsProps) {
  return (
    <SwaggerUI
      url={`${apiBaseUrl}/api/openapi`}
      tryItOutEnabled
      docExpansion="full"
      defaultModelsExpandDepth={3}
      defaultModelExpandDepth={3}
      filter={tag || undefined}
    />
  );
}
