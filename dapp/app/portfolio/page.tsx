// app/portfolio/page.tsx
import { loadJsonLdScripts } from '@lib/jsonld/loadJsonFromIndex';
import jsonLdData from './jsonld';
import { portfolioPageMetadata } from './metadata';
import PortfolioClient from './PortfolioClient';
import Music from './components/music/Music';
import styles from './page.module.css';

export const metadata = portfolioPageMetadata;

export default function Page() {
  return (
    <>
      {loadJsonLdScripts(jsonLdData, 'portfolio-jsonld')}

      <div className={styles.PageWrapper}>
        <PortfolioClient />
        <div
          style={{
            width: '90%',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <Music />
        </div>
      </div>
    </>
  );
}
