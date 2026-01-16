export const exportToCSV = (data, filename) => {
  if (!data || !data.length) {
    console.error("No data to export");
    return;
  }

  // Extract headers from the first object
  const headers = Object.keys(data[0]);
  
  // Convert data to CSV format
  const csvContent = [
    headers.join(","), // Header row
    ...data.map(row => 
      headers.map(header => {
        let value = row[header];
        
        // Handle nested arrays or objects
        if (Array.isArray(value)) {
          value = `"${value.join("; ")}"`;
        } else if (typeof value === "object" && value !== null) {
          value = `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        } else if (typeof value === "string") {
          // Escape quotes in strings
          value = `"${value.replace(/"/g, '""')}"`;
        }
        
        return value;
      }).join(",")
    )
  ].join("\n");

  // Create a blob and trigger download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
