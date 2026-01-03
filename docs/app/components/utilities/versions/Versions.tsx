import versions from '@lib/versions';

interface VersionProps {
  workspace: keyof typeof versions;
  prefix?: string;
  suffix?: string;
  className?: string;
}

// Simple version text component - just returns the version value
export function Version({ 
  workspace, 
  prefix = 'v', 
  suffix = '',
  className = ''
}: VersionProps) {
  const version = versions[workspace] || 'unknown';
  return <span className={className}>{prefix}{version}{suffix}</span>;
}

// Badge style version component
export function VersionBadge({ 
  workspace, 
  className = '' 
}: Omit<VersionProps, 'prefix' | 'suffix'>) {
  const version = versions[workspace] || 'unknown';
  return (
    <span 
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.25rem 0.75rem',
        borderRadius: '1rem',
        fontSize: '0.875rem',
        fontFamily: 'var(--font-body)',
        backgroundColor: 'var(--secondary-color)',
        color: '#ffffff',
        border: 'var(--default-border)'
      }}
    >
      v{version}
    </span>
  );
}

// Table showing all versions
export function VersionTable({ className = '' }: { className?: string }) {
  return (
    <table 
      className={className}
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontFamily: 'var(--font-body)',
        backgroundColor: 'var(--primary-color)',
        color: '#ffffff'
      }}
    >
      <thead>
        <tr style={{ borderBottom: 'var(--default-border)' }}>
          <th style={{
            padding: '1rem',
            textAlign: 'left',
            fontFamily: 'var(--font-primary)',
            fontSize: '0.875rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Workspace
          </th>
          <th style={{
            padding: '1rem',
            textAlign: 'left',
            fontFamily: 'var(--font-primary)',
            fontSize: '0.875rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Version
          </th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(versions).map(([name, version]) => (
          <tr key={name} style={{ borderBottom: '1px solid var(--secondary-color)' }}>
            <td style={{
              padding: '0.75rem 1rem',
              fontWeight: 500
            }}>
              {name}
            </td>
            <td style={{
              padding: '0.75rem 1rem',
              color: 'var(--accent-color-2)'
            }}>
              v{version}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}