export function LoginBrandTag() {
  return (
    <div
      className="login-tag-brand"
      role="img"
      aria-label="wearlog 衣LOG，个人衣橱档案"
    >
      <img
        className="login-tag-brand__material"
        src="/brand/login-tag-hangtag.png"
        alt=""
        aria-hidden="true"
      />

      <div className="login-tag-brand__copy" aria-hidden="true">
        <span className="login-tag-brand__eyebrow">GARMENT / ARCHIVE</span>
        <span className="login-tag-brand__name">wearlog</span>
        <span className="login-tag-brand__chinese">衣 LOG</span>
        <span className="login-tag-brand__rule" />
        <span className="login-tag-brand__detail">PERSONAL WARDROBE RECORDS</span>
        <span className="login-tag-brand__footer">KEEP WHAT YOU WEAR</span>
      </div>
    </div>
  );
}
