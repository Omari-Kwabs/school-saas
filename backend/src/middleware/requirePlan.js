const PLAN_RANK = { trial: 0, basic: 1, premium: 2 };

// Returns middleware that blocks schools below the required plan tier.
// System admins bypass plan checks entirely.
module.exports = function requirePlan(minPlan) {
  return (req, res, next) => {
    if (req.user.role === 'system_admin') return next();
    const schoolPlan = req.school?.plan || 'trial';
    if ((PLAN_RANK[schoolPlan] ?? 0) >= (PLAN_RANK[minPlan] ?? 0)) return next();
    return res.status(403).json({
      error: `This feature requires a ${minPlan} plan. Please upgrade your subscription.`,
    });
  };
};
