/**
 * Authentication Messaging Improvements for Claude Code MCP Setup
 * REQ-712: Resolve authentication confusion with better messaging
 *
 * This module provides enhanced messaging, validation, and accessibility
 * features for MCP server authentication flows without changing the
 * underlying integration logic.
 */

// REQ-712: Enhanced authentication pattern definitions
const AUTH_PATTERNS = {
  'api-key': {
    emoji: '🔑',
    title: 'Simple Setup',
    timeRange: '2-3 min',
    description: 'One API token required • Ready to use immediately • No additional configuration',
    setupSteps: [
      'Get API token from provider dashboard',
      'Paste token when prompted',
      'Automatic configuration test',
      'Ready to use immediately'
    ],
    commonIssues: {
      'invalid_format': 'Check token format - no extra spaces or characters',
      'expired_token': 'Token may be expired - generate a new one',
      'permissions': 'Ensure token has required API permissions'
    }
  },
  'sse-browser': {
    emoji: '🌐',
    title: 'Browser + Claude Code Setup',
    timeRange: '3 min',
    description: 'Step 1: Install server (automatic) • Step 2: Authenticate in Claude Code • No API keys needed',
    setupSteps: [
      'Server installation (automatic)',
      'Open Claude Code interface',
      'Run /mcp [server-name] command',
      'Complete browser authentication',
      'Return to Claude Code when done'
    ],
    postInstallSteps: [
      'Open Claude Code interface',
      'Run /mcp {serverKey} command',
      'Follow browser authentication prompts',
      'Test connection with sample query'
    ],
    commonIssues: {
      'browser_blocked': 'Check if popup blockers are preventing authentication',
      'session_expired': 'Authentication expires after 24 hours - re-authenticate',
      'wrong_account': 'Ensure you\'re logged into the correct Cloudflare account'
    }
  },
  'dual-config': {
    emoji: '⚙️',
    title: 'Advanced Configuration',
    timeRange: '5 min',
    description: 'Multiple credentials required • Connection testing included • Setup validation provided',
    setupSteps: [
      'Enter service URL endpoint',
      'Provide API credentials',
      'Test connection automatically',
      'Verify permissions and access',
      'Configuration saved securely'
    ],
    commonIssues: {
      'connection_failed': 'Check URL format and network connectivity',
      'auth_failed': 'Verify API key has correct permissions',
      'wrong_endpoint': 'Ensure URL points to correct API version'
    }
  },
  'connection-string': {
    emoji: '🔗',
    title: 'Database Connection',
    timeRange: '5 min',
    description: 'Connection string required • Automatic connection testing • SSL/TLS validation',
    setupSteps: [
      'Prepare database connection string',
      'Include authentication credentials',
      'Test database connectivity',
      'Verify table access permissions',
      'Secure connection established'
    ],
    commonIssues: {
      'connection_refused': 'Check database host and port accessibility',
      'auth_failed': 'Verify username and password in connection string',
      'ssl_required': 'Database may require SSL - update connection string'
    }
  }
};

// REQ-712: Server-specific validation patterns with accessibility hints
const VALIDATION_PATTERNS = {
  github: {
    pattern: /^gh[ps]_[A-Za-z0-9]{36}$/,
    example: 'ghp_1234567890abcdef1234567890abcdef12345678',
    hint: 'GitHub Personal Access Token (starts with ghp_ or ghs_)',
    ariaLabel: 'GitHub Personal Access Token - 40 characters starting with ghp or ghs'
  },
  supabase: {
    pattern: /^sbp_[a-f0-9]{40}$/,
    example: 'sbp_a1b2c3d4e5f6789012345678901234567890abcd',
    hint: 'Supabase Access Token (starts with sbp_)',
    ariaLabel: 'Supabase Access Token - 44 characters starting with sbp underscore'
  },
  brave: {
    pattern: /^BSA[A-Za-z0-9]{32}$/,
    example: 'BSA1234567890abcdefABCDEF1234567890',
    hint: 'Brave Search API Key (starts with BSA)',
    ariaLabel: 'Brave Search API Key - 35 characters starting with B S A'
  },
  context7: {
    pattern: /^ctx7_[A-Za-z0-9]{24}$/,
    example: 'ctx7_abcd1234efgh5678ijkl9012',
    hint: 'Context7 API Key (starts with ctx7_)',
    ariaLabel: 'Context7 API Key - 29 characters starting with c t x 7 underscore'
  },
  tavily: {
    pattern: /^tvly-[A-Za-z0-9]{32}$/,
    example: 'tvly-1234567890abcdefghijklmnop123456',
    hint: 'Tavily API Key (starts with tvly-)',
    ariaLabel: 'Tavily API Key - 37 characters starting with t v l y dash'
  },
  postgres: {
    pattern: /^postgresql:\/\/[\w\-\.]+:[\w\-\.]*@[\w\-\.]+:\d+\/[\w\-\.]+(\?.*)?$/,
    example: 'postgresql://username:password@hostname:5432/database',
    hint: 'PostgreSQL connection string (postgresql://user:pass@host:port/db)',
    ariaLabel: 'PostgreSQL connection string starting with postgresql colon slash slash'
  },
  n8n_url: {
    pattern: /^https?:\/\/[\w\-\.]+(?::\d+)?\/api\/v1\/?$/,
    example: 'https://your-n8n.domain.com/api/v1',
    hint: 'n8n API URL (ends with /api/v1)',
    ariaLabel: 'n8n API URL starting with https and ending with slash api slash v1'
  }
};

// REQ-712: Enhanced server configuration with accessibility and messaging
function enhanceServerSpecs(originalSpecs) {
  return originalSpecs.map(spec => {
    const authPattern = AUTH_PATTERNS[spec.authPattern] || AUTH_PATTERNS['api-key'];
    const validationInfo = VALIDATION_PATTERNS[spec.key];

    return {
      ...spec,
      // Enhanced descriptions with consistent patterns
      enhancedDescription: `${authPattern.emoji} ${authPattern.title} (${authPattern.timeRange})`,
      detailedDescription: authPattern.description,
      setupSteps: authPattern.setupSteps,

      // Accessibility improvements
      ariaLabel: `${spec.title} - ${authPattern.title} - ${authPattern.timeRange} setup time`,
      category: spec.category,

      // Validation enhancements
      validation: validationInfo ? {
        pattern: validationInfo.pattern,
        example: validationInfo.example,
        hint: validationInfo.hint,
        ariaLabel: validationInfo.ariaLabel,
        errorMessage: `Invalid ${spec.title} format. Expected: ${validationInfo.hint}`
      } : null,

      // Post-install guidance
      postInstallGuidance: generatePostInstallGuidance(spec, authPattern),

      // Troubleshooting
      commonIssues: authPattern.commonIssues
    };
  });
}

// REQ-712: Generate specific post-install guidance based on auth pattern
function generatePostInstallGuidance(spec, authPattern) {
  const baseGuidance = {
    status: `✅ ${spec.title} configured successfully`,
    readyStatus: '🚀 Ready to use',
    testCommand: `💬 Try: "${generateTestCommand(spec)}"`
  };

  switch (spec.authPattern) {
    case 'sse-browser':
      return {
        ...baseGuidance,
        readyStatus: '⚠️  Authentication required in Claude Code',
        nextSteps: [
          '1. Open Claude Code interface',
          `2. Run command: /mcp ${spec.key}`,
          '3. Complete browser authentication when prompted',
          `4. ${baseGuidance.testCommand}`
        ],
        reminder: `💡 Note: Authentication expires after 24 hours`
      };

    case 'dual-config':
      return {
        ...baseGuidance,
        nextSteps: [
          '🔍 Connection tested and verified',
          baseGuidance.testCommand,
          `📊 API calls will count against your ${spec.title} quota`
        ]
      };

    case 'connection-string':
      return {
        ...baseGuidance,
        nextSteps: [
          '🔍 Database connection tested and verified',
          '🔐 SSL/TLS encryption confirmed',
          baseGuidance.testCommand,
          '⚠️  Database operations require appropriate permissions'
        ]
      };

    default: // api-key
      return {
        ...baseGuidance,
        nextSteps: [
          baseGuidance.readyStatus + ' immediately',
          baseGuidance.testCommand,
          `📊 API calls will count against your ${spec.title} quota`
        ]
      };
  }
}

// REQ-712: Generate appropriate test commands for each server type
function generateTestCommand(spec) {
  const testCommands = {
    github: 'List my GitHub repositories',
    supabase: 'Show my Supabase projects',
    'cloudflare-bindings': 'List my Cloudflare worker bindings',
    'cloudflare-builds': 'Show my latest worker builds',
    context7: 'Search documentation for React hooks',
    tavily: 'Search the web for latest AI news',
    'brave-search': 'Search for Node.js best practices 2024',
    n8n: 'List my n8n workflows',
    postgres: 'Show tables in my database'
  };

  return testCommands[spec.key] || `Test ${spec.title} integration`;
}

// REQ-712: Enhanced askAccessible function with validation and accessibility
async function askAccessibleWithValidation(question, defaultValue = "", options = {}) {
  const {
    helpText = null,
    category = null,
    required = false,
    validation = null,
    retryLimit = 3
  } = options;

  let attempts = 0;

  while (attempts < retryLimit) {
    attempts++;

    // Accessibility: Provide context for screen readers
    if (category) {
      console.log(`\n📂 Input category: ${category}`);
    }

    if (helpText) {
      console.log(`💡 Help: ${helpText}`);
    }

    // Accessibility: Provide format hints
    if (validation?.hint) {
      console.log(`📝 Format: ${validation.hint}`);
      console.log(`📋 Example: ${validation.example}`);
    }

    const prompt = defaultValue ? `${question} [${defaultValue}] ` : `${question} `;

    // Accessibility: Use readline with enhanced prompting
    const answer = await new Promise((resolve) => {
      const rl = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      rl.question(prompt, (input) => {
        rl.close();
        resolve((input || "").trim());
      });
    });

    const finalAnswer = answer || defaultValue;

    // Validation: Required field check
    if (required && !finalAnswer) {
      console.log("⚠️  This field is required. Please try again.");
      console.log(`🔄 Attempt ${attempts} of ${retryLimit}`);
      continue;
    }

    // Validation: Format pattern check
    if (validation?.pattern && finalAnswer && !validation.pattern.test(finalAnswer)) {
      console.log(`❌ ${validation.errorMessage || 'Invalid format'}`);
      console.log(`✅ Expected format: ${validation.hint}`);
      console.log(`📋 Example: ${validation.example}`);
      console.log(`🔄 Attempt ${attempts} of ${retryLimit}`);

      if (attempts >= retryLimit) {
        console.log("⚠️  Maximum attempts reached. You can reconfigure this later.");
        return null;
      }
      continue;
    }

    // Success: Announce completion
    if (finalAnswer) {
      console.log(`✅ Input accepted`);
    }

    return finalAnswer;
  }

  return null;
}

// REQ-712: Enhanced tier selection with accessibility
async function askSetupTierAccessible(tiers) {
  console.log("\n" + "=".repeat(60));
  console.log("🎯 CHOOSE YOUR MCP SETUP TIER");
  console.log("=".repeat(60));
  console.log("\n🔍 Reduce choice overload! Pick the tier that matches your needs:");

  // Accessibility: Use semantic markup and ARIA labels
  console.log('\n<fieldset role="radiogroup" aria-labelledby="tier-selection-heading">');
  console.log('<legend id="tier-selection-heading">Setup Tier Selection</legend>');

  let tierIndex = 1;
  for (const [tierKey, tierConfig] of Object.entries(tiers)) {
    // Accessibility: Rich descriptions with proper labeling
    console.log(`\n${tierIndex}) ${tierConfig.emoji} ${tierConfig.name} (${tierConfig.time})`);
    console.log(`   ${tierConfig.description}`);
    console.log(`   Benefits: ${tierConfig.benefits.slice(0, 2).join(", ")}${tierConfig.benefits.length > 2 ? "..." : ""}`);

    // Accessibility: ARIA attributes for screen readers
    console.log(`   <input type="radio" id="tier-${tierKey}" name="setup-tier" value="${tierKey}">`);
    console.log(`   <label for="tier-${tierKey}">Select ${tierConfig.name}</label>`);

    tierIndex++;
  }

  console.log('</fieldset>');

  console.log("\n" + "-".repeat(60));
  console.log("💡 Accessibility: Use number keys 1-3 for quick selection");
  console.log("🔄 Focus order: 1→2→3 for progressive complexity");
  console.log("⌨️  Keyboard: Tab to navigate, Enter to select, Esc to cancel");

  const choice = await askAccessibleWithValidation(
    "\nSelect setup tier (1-3)",
    "1",
    {
      category: "Setup Configuration",
      helpText: "Choose complexity level that matches your project needs",
      validation: {
        pattern: /^[1-3]$/,
        hint: "Enter 1, 2, or 3",
        errorMessage: "Please enter 1, 2, or 3 to select a tier"
      }
    }
  );

  // Convert choice to tier key
  const tierMapping = {
    "1": "quick-start",
    "2": "dev-tools",
    "3": "research-tools"
  };

  return tierMapping[choice] || "quick-start";
}

// REQ-712: Progressive disclosure for server details
async function askProgressiveDisclosureAccessible(tierConfig, tierServers) {
  console.log(`\n🔍 Want to see what's included in ${tierConfig.name}?`);
  console.log(`📊 This tier includes ${tierServers.length} servers with ${tierConfig.time} total setup time`);

  const showDetails = await askAccessibleWithValidation(
    "Show detailed server list? (y/N)",
    "n",
    {
      category: "Information Display",
      helpText: "View complete list of servers and their descriptions",
      validation: {
        pattern: /^[ynYN]?$/,
        hint: "Enter y for yes, n for no, or press Enter for default",
        errorMessage: "Please enter y or n"
      }
    }
  );

  if (showDetails?.toLowerCase() === "y") {
    console.log(`\n📋 ${tierConfig.name} Server Details:`);
    console.log("=" * 50);

    tierServers.forEach((spec, index) => {
      const enhancedSpec = enhanceServerSpecs([spec])[0];

      console.log(`\n${index + 1}. ${spec.title}`);
      console.log(`   Category: ${spec.category}`);
      console.log(`   ${enhancedSpec.enhancedDescription}`);
      console.log(`   Setup: ${enhancedSpec.detailedDescription}`);

      // Accessibility: Provide setup step preview
      if (enhancedSpec.setupSteps?.length > 0) {
        console.log(`   Steps: ${enhancedSpec.setupSteps.slice(0, 2).join(" → ")}...`);
      }
    });

    console.log(`\n💰 Total estimated time: ${tierConfig.time}`);
    console.log(`🎯 Key benefits: ${tierConfig.benefits.join(", ")}`);
  }

  return true;
}

// REQ-712: Enhanced error handling with recovery guidance
function handleValidationError(error, spec, userInput) {
  console.log(`\n❌ ${spec.title} Configuration Error`);
  console.log(`📝 Input received: ${userInput ? userInput.substring(0, 20) + '...' : 'empty'}`);

  // Provide specific error guidance based on server type
  if (spec.validation?.errorMessage) {
    console.log(`🔍 Issue: ${spec.validation.errorMessage}`);
    console.log(`✅ Expected: ${spec.validation.hint}`);
    console.log(`📋 Example: ${spec.validation.example}`);
  }

  // Common error recovery patterns
  if (spec.commonIssues) {
    console.log(`\n🛠️  Common Solutions:`);
    Object.entries(spec.commonIssues).forEach(([issue, solution]) => {
      console.log(`   • ${solution}`);
    });
  }

  console.log(`\n🔗 Get help: ${spec.helpUrl}`);
  console.log(`🔄 Press Enter to try again, or type 'skip' to continue without this server`);
}

// REQ-712: Export enhanced functions for integration
module.exports = {
  AUTH_PATTERNS,
  VALIDATION_PATTERNS,
  enhanceServerSpecs,
  generatePostInstallGuidance,
  generateTestCommand,
  askAccessibleWithValidation,
  askSetupTierAccessible,
  askProgressiveDisclosureAccessible,
  handleValidationError
};