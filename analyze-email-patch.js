// Temporary patch for analyze-email function
// Add this validation code right before the database insert

// Validate and clean the analysis result
const cleanAnalysisResult = (result) => {
  const allowedCategories = [
    "Pending",
    "Failed payment", 
    "Chargeback",
    "Cancelled policy",
    "Post Underwriting Update",
    "Pending Lapse",
    "Declined/Closed as Incomplete"
  ];

  // Clean the category
  if (!allowedCategories.includes(result.category)) {
    console.warn(`Invalid category "${result.category}", defaulting to "Pending"`);
    result.category = "Pending";
  }

  // Clean the subcategory to remove any invalid characters
  if (result.subcategory) {
    result.subcategory = result.subcategory.substring(0, 255); // Limit length
  }

  // Clean customer name and policy ID
  if (result.customer_name) {
    result.customer_name = result.customer_name.substring(0, 255);
  }
  
  if (result.policy_id) {
    result.policy_id = result.policy_id.substring(0, 255);
  }

  // Clean summary and suggested action
  if (result.summary) {
    result.summary = result.summary.substring(0, 1000);
  }
  
  if (result.suggested_action) {
    result.suggested_action = result.suggested_action.substring(0, 1000);
  }

  return result;
};

// Use this before inserting:
const cleanedResult = cleanAnalysisResult(analysisResult);

// Then insert cleanedResult instead of analysisResult
