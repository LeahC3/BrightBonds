// Valid senior access codes - store these securely
const VALID_SENIOR_CODES = new Set([
  'SENIOR',  // Example codes - replace with your actual codes
  'ACCESS',
  'BRIGHT',
  'BONDS1',
  'CARE01'
]);

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
exports.handler = async (event, context) => {
  console.log('Pre Sign-up trigger received:', JSON.stringify(event));
  
  // Get user attributes
  const userAttributes = event.request.userAttributes;
  const birthdate = userAttributes.birthdate;
  const seniorCode = userAttributes.address || '';
  
  // Check if user is a senior (born before 1995)
  if (birthdate) {
    const birthYear = new Date(birthdate).getFullYear();
    if (birthYear < 1995) {
      // Senior user - validate access code
      if (!seniorCode || !VALID_SENIOR_CODES.has(seniorCode.toUpperCase())) {
        throw new Error('Invalid senior access code');
      }
    }
  }
  
  // Allow signup to proceed
  return event;
};
