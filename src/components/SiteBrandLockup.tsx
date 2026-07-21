/** Compact authenticated-header lockup: a real hangtag mark beside the wordmark. */
export function SiteBrandLockup() {
  return (
    <span className="site-brand-lockup" aria-label="wearlog 衣LOG，个人衣物档案">
      <span className="site-brand-lockup__tag" aria-hidden="true">
        <img src="/brand/login-tag-hangtag.png" alt="" />
        <span className="site-brand-lockup__tag-copy">
          <span>wearlog</span>
          <small>ARCHIVE</small>
        </span>
      </span>
      <span className="site-brand-lockup__wordmark" aria-hidden="true">
        衣<em>LOG</em>
      </span>
    </span>
  );
}
