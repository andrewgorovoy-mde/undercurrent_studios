\# Downloading Data from Google Cloud Storage

This page explains, in simple terms, how to download data files from the Event Footprint Catalog related buckets in Google Cloud Storage (GCS).

You do not need to be a cloud expert, but you do need:

\- A Google account.  
\- The Google Cloud SDK installed (\`gcloud\` and \`gsutil\`).  
\- A terminal (Command Prompt, PowerShell, or a shell in VS Code).

The examples below use \`gsutil\`, which is a command line tool for working with GCS.

\---

\#\# 1\. Log In and Check Access

1\. Open a terminal.  
2\. Run:

   \`\`\`bash  
   gcloud auth login  
   \`\`\`

3\. Follow the prompts in your browser to sign in.  
4\. In the same terminal, run a simple list command to confirm access, for example:

   \`\`\`bash  
   gsutil ls gs://noaa-ncei-ipg/datasets/event-catalog/  
   \`\`\`

If you see a list of folders or files, your setup is working.

\---

\#\# 2\. Basic \`gsutil cp\` Example

The simplest way to download a single file is with a \`cp\` command/

Example:

\`\`\`bash  
gsutil cp gs://noaa-ncei-ipg/datasets/event-catalog/tornado/2011\_tornado\_footprint.geojson ./  
\`\`\`

This copies \`2011\_tornado\_footprint.geojson\` from the bucket to your current folder.

\- \`gs://noaa-ncei-nclimgrid-ipg/...\` is the source in GCS.  
\- \`./\` is the destination on your local machine (the current directory).

\---

\#\# 3\. Downloading Many Files at Once with \`-m\`

To download many files at once, you can:

\- List all the file paths.  
\- Pass them all to one \`gsutil cp\` command.  
\- Add \`-m\` to run the copies in parallel (faster).

\#\#\# Example: First 10 days of hail data from October 202

\`\`\`bash  
gsutil \-m cp \\  
  "gs://noaa-ncei-ipg/datasets/event-catalog/hail/mrms\_hail\_data\_2020-10-14.geojson" \\  
  "gs://noaa-ncei-ipg/datasets/event-catalog/hail/mrms\_hail\_data\_2020-10-15.geojson" \\  
  "gs://noaa-ncei-ipg/datasets/event-catalog/hail/mrms\_hail\_data\_2020-10-16.geojson" \\  
  "gs://noaa-ncei-ipg/datasets/event-catalog/hail/mrms\_hail\_data\_2020-10-17.geojson" \\  
  "gs://noaa-ncei-ipg/datasets/event-catalog/hail/mrms\_hail\_data\_2020-10-18.geojson" \\  
  "gs://noaa-ncei-ipg/datasets/event-catalog/hail/mrms\_hail\_data\_2020-10-19.geojson" \\  
  "gs://noaa-ncei-ipg/datasets/event-catalog/hail/mrms\_hail\_data\_2020-10-20.geojson" \\  
  "gs://noaa-ncei-ipg/datasets/event-catalog/hail/mrms\_hail\_data\_2020-10-21.geojson" \\  
  "gs://noaa-ncei-ipg/datasets/event-catalog/hail/mrms\_hail\_data\_2020-10-22.geojson" \\  
  "gs://noaa-ncei-ipg/datasets/event-catalog/hail/mrms\_hail\_data\_2020-10-23.geojson" \\  
  ./  
\`\`\`

Notes:

\- Each line after the first is another file to copy.  
\- The final \`./\` is the local destination folder.  
\- The backslashes (\`\\\`) at the end of each line are a shell line continuation. They work in bash and many Unix like shells. On Windows PowerShell, you can put the command on one long line instead.

\---

\#\# 4\. Using Wildcards

\`gsutil\` supports wildcards for simple patterns.

For example, to download all May 2021 hail files:

\`\`\`bash  
gsutil \-m cp "gs://noaa-ncei-ipg/datasets/event-catalog/hail/mrms\_hail\_data\_2021-05\*.geojson" ./  
\`\`\`

This matches any file that starts with \`mrms\_hail\_data\_2021-05\` and ends with \`.geojson\`.

Be careful with wildcards:

\- Always run a list first to see what you will get:

  \`\`\`bash  
  gsutil ls "gs://noaa-ncei-ipg/datasets/event-catalog/hail/mrms\_hail\_data\_2021-05\*.geojson"  
  \`\`\`

\- If the list looks correct, then run the \`cp\` command.

\---

\#\# 5\. Troubleshooting Tips

If something goes wrong:

\- \*\*Permission errors\*\*: check that you are logged in with a Google account that has access to the bucket.  
\- \*\*Typos in paths\*\*: use \`gsutil ls\` to verify the exact bucket name and folder structure.  
\- \*\*Slow downloads\*\*: use \`-m\` for parallel copies, but be mindful of network limits.

When in doubt, start by listing paths with \`gsutil ls\`, confirm they are correct, and only then run the \`cp\` commands.  
