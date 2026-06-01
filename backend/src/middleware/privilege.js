module.exports = function requirePrivilege(privilege) {
  return (req, res, next) => {
    const privs = req.user?.privileges;
    if (Array.isArray(privs) && privs.includes(privilege)) return next();
    return res.status(403).json({ error: 'Forbidden' });
  };
};
