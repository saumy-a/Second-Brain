const supabase = require("./supabase");

module.exports = {
  supabase,
  // Example service function
  getGreeting: () => {
    return "Hello from the Service layer!";
  }
};
