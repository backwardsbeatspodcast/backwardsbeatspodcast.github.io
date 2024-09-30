import os
import subprocess
import shutil
import textwrap
from markdown2 import markdown

# Step 1: Prompt for episode number
def get_episode_path(episode_number):
  base_path = "/Users/dwoodard/Library/CloudStorage/GoogleDrive-backwardsbeatspodcast@gmail.com/My Drive/Shows/Backwards Beats/Episodes"
  episode_path = None
  padded_episode_number = str(episode_number).zfill(3)

  for folder in os.listdir(base_path):
      if folder.startswith(f"Episode {padded_episode_number}"):
        episode_path = os.path.join(base_path, folder)
        break

  if episode_path:
      return find_audio_file(episode_path)
  return None

def find_audio_file(folder_path):
    for file_name in os.listdir(folder_path):
        if file_name.endswith(".md"):
            return os.path.join(folder_path, file_name)

def truncate_to_word_boundary(text, limit):
    if len(text) <= limit:
        return text
    truncated = textwrap.shorten(text, width=limit, placeholder='...')
    return truncated

# Step 2: Read the markdown file and generate a short summary (3-5 lines max)
def generate_summary(markdown_content):
    lines = markdown_content.split('\n')
    summary_lines = []
    capture_header = False
    capture_paragraph = False
    paragraph = ''

    for line in lines:
        # Start capturing after the first H1 header
        if line.startswith('# ') and not capture_header:
            capture_header = True
            summary_lines.append(line)
            continue

        # Append any lines between H1 and H2
        if capture_header and not line.startswith('### '):
            if not line.strip() or '[Album Cover]' in line:
                continue  # Skip empty lines or the album cover link
            summary_lines.append(line)
        
        # Detect the H2 header and append it
        if line.startswith('### '):
            summary_lines.append(line)
            capture_header = False  # Stop capturing after the first paragraph
            capture_paragraph = True  # Start capturing the paragraph
            continue
        
        # Capture the paragraph as a whole after H2
        if capture_paragraph and line.strip():
            paragraph = line
            capture_paragraph = False
            break  # Stop once the first paragraph is captured

    # Truncate the paragraph to 170 characters, stopping at a word break
    truncated_paragraph = truncate_to_word_boundary(paragraph, 170)

    summary = "\n".join(summary_lines) + "\n"+truncated_paragraph
    return convert_markdown_to_html(summary)

# Step 3: Convert markdown to HTML
def convert_markdown_to_html(markdown_content):
    html_content = markdown(markdown_content)
    return html_content

def extract_episode_details(markdown_path):
    # Split the path and find the folder containing the episode details
    parts = markdown_path.split(os.sep)
    
    # Find the segment containing the episode details
    for part in parts:
        if part.startswith("Episode") and '-' in part:
            folder_name = part
            break

    # Remove the "Episode " prefix and extract the details
    folder_name = folder_name.replace("Episode ", "")
    
    # Split the folder name by hyphens
    episode_number, album_name, band_name = folder_name.split('-', 2)
    
    return episode_number, album_name, band_name

# Step 4: Append the summary to index.html
def append_summary_to_index(episode_number, summary):
    index_path = 'episodes/index.html'  # Adjust as necessary

    # Read the index file
    with open(index_path, 'r') as file:
        index_content = file.read()

    # Add the summary with a link to the episode folder
    new_entry = f'<li><a href="{episode_number}-album_name-band_name/index.html">Episode {episode_number}</a>: {summary}</li>'

    # Append the new entry and write back the index file
    with open(index_path, 'w') as file:
        updated_content = index_content.replace('</ul>', f'  {new_entry}\n</ul>')
        file.write(updated_content)

def copy_episode_template(episode_folder_path):
    # Path to the _episode-template.html file (assuming it's in the 'episodes' directory)
    template_path = os.path.join('episodes', '_episode-template.html')
    
    # Destination path: copy the template and rename it to index.html in the episode folder
    destination_path = os.path.join(episode_folder_path, 'index.html')
    
    # Copy the template to the destination and rename it
    shutil.copyfile(template_path, destination_path)

def create_meta_html(episode_folder_path, episode_number, episode_title, album_name, band_name, episode_url):
    # Path to the _meta-template.html file (assuming it's in the 'episodes' directory)
    template_path = os.path.join('episodes', '_meta-template.html')

    # Read the contents of the template
    with open(template_path, 'r') as template_file:
        meta_content = template_file.read()

    # Perform string interpolation
    meta_content = meta_content.format(
        episode_number=episode_number,
        episode_title=episode_title,
        album_name=album_name,
        band_name=band_name,
        episode_url=episode_url
    )

    # Destination path for the meta file in the episode folder
    meta_destination_path = os.path.join(episode_folder_path, 'meta.html')

    # Write the updated meta content to the new file
    with open(meta_destination_path, 'w') as meta_file:
        meta_file.write(meta_content)

    print(f"Successfully created '{meta_destination_path}' with episode details.")

# Step 5: Publish changes to the GitHub repo
def publish_to_github():
    repo_path = os.getcwd()  # Use current directory as root of the repo

    # Stage, commit, and push changes
    subprocess.run(['git', 'add', '.'])
    subprocess.run(['git', 'commit', '-m', 'Update episode notes'])
    subprocess.run(['git', 'push', 'origin', 'main'])


# Main execution flow
def main():
    # Prompt user for episode number
    episode_number = input("Enter episode number: ")

    # Get the path to the markdown file
    markdown_file_path = get_episode_path(episode_number)

    # Read the markdown content
    with open(markdown_file_path, 'r') as file:
        markdown_content = file.read()

    # Generate summary
    summary = generate_summary(markdown_content)

    # Convert markdown to HTML
    html_content = convert_markdown_to_html(markdown_content)

    # Save the HTML content to the episode folder
    episode_number, album_name, band_name = extract_episode_details(markdown_file_path)
    episode_html_path = f'episodes/{episode_number}-{album_name}-{band_name}'
    episode_html_file = episode_html_path + '/episode.html'

    # Create the episode folder if it doesn't exist
    if not os.path.exists(episode_html_path):
        os.makedirs(episode_html_path)

    with open(episode_html_file, 'w') as file:
        file.write(html_content)

    # Copy the episode template to the episode folder_name
    copy_episode_template(f'episodes/{episode_number}-{album_name}-{band_name}')

    # Read the episode.html content, and update the meta tags
    with open(episode_html_path+'/index.html', 'r') as episode_file:
        episode_content = episode_file.read()

    episode_title = f"Episode {episode_number}: {album_name} by {band_name}"
    episode_url = f"https://backwardsbeatspodcast.github.io/episodes/{episode_number}-{album_name}-{band_name}/episode.html"

    # Prepare values to replace placeholders
    replacements = {
        "{episode_number}": episode_number,
        "{episode_title}": episode_title,
        "{album_name}": album_name,
        "{band_name}": band_name,
        "{episode_url}": episode_url,
    }

    # Replace placeholders in the episode content
    for placeholder, value in replacements.items():
        episode_content = episode_content.replace(placeholder, value)

    # Write the updated content back to episode.html
    with open(episode_html_path + '/index.html', 'w') as episode_file:
        episode_file.write(episode_content)

    return
    # Append summary to the main index.html
    append_summary_to_index(episode_number,markdown_file_path, summary)

    # Publish to GitHub
    publish_to_github()

# Run the process
if __name__ == '__main__':
    main()

