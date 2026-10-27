type GithubButtonProps = {
  className?: string
}

export function GithubButton({ className = '' }: GithubButtonProps) {
  return (
    <a
      className={`social-link-button ${className}`.trim()}
      href="https://github.com/zyf2007/ChatAPI"
      target="_blank"
      rel="noreferrer noopener"
      aria-label="打开 ChatAPI GitHub 仓库"
      title="打开 ChatAPI GitHub 仓库"
    >
      <span className="social-link-icon" aria-hidden="true">
        <svg viewBox="0 0 19 19" fill="none">
          <use href="/icons.svg#github-icon" />
        </svg>
      </span>
    </a>
  )
}
