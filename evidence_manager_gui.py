import os
import shutil
import csv
import json
import uuid
import webbrowser
from pathlib import Path
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from PIL import Image, ImageTk

# Add these constants at the top
WEB_URL_BASE = "http://localhost:8000"  # Base URL for web display
IMAGES_SUBDIR = "images"  # Subdirectory name for images

class EvidenceManagerGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Network Evidence Manager")
        self.root.geometry("1000x800")  # Made window larger to accommodate images
        
        # Store image references to prevent garbage collection
        self.image_refs = {}
        
        # Initialize data manager
        self.data_manager = DataManager()
        
        # Create main container with padding
        self.main_frame = ttk.Frame(root, padding="10")
        self.main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        root.grid_rowconfigure(0, weight=1)
        root.grid_columnconfigure(0, weight=1)
        
        # Create top and bottom frames
        self.top_frame = ttk.Frame(self.main_frame)
        self.bottom_frame = ttk.Frame(self.main_frame)
        self.top_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        self.bottom_frame.grid(row=1, column=0, sticky=(tk.W, tk.E, tk.N, tk.S), pady=10)
        
        # Configure grid weights
        self.main_frame.grid_rowconfigure(1, weight=1)  # Make bottom panel expand
        self.main_frame.grid_columnconfigure(0, weight=1)  # Make both panels full width
        
        self.setup_top_panel()
        self.setup_bottom_panel()
        
        # Initialize variables
        self.current_item = None
        self.current_type = None
        
        # Load initial data
        self.refresh_data()

    def setup_top_panel(self):
        """Setup the top panel with item selection and basic info"""
        # Item type selection
        ttk.Label(self.top_frame, text="Select Type:").grid(row=0, column=0, sticky=tk.W, pady=5)
        self.type_var = tk.StringVar()
        type_combo = ttk.Combobox(self.top_frame, textvariable=self.type_var, values=['Node', 'Edge'])
        type_combo.grid(row=0, column=1, sticky=(tk.W, tk.E), pady=5)
        type_combo.bind('<<ComboboxSelected>>', self.on_type_selected)
        
        # Item selection
        ttk.Label(self.top_frame, text="Select Item:").grid(row=1, column=0, sticky=tk.W, pady=5)
        self.item_var = tk.StringVar()
        self.item_combo = ttk.Combobox(self.top_frame, textvariable=self.item_var)
        self.item_combo.grid(row=1, column=1, sticky=(tk.W, tk.E), pady=5)
        self.item_combo.bind('<<ComboboxSelected>>', self.on_item_selected)
        
        # Basic info frame
        info_frame = ttk.LabelFrame(self.top_frame, text="Basic Information", padding="5")
        info_frame.grid(row=2, column=0, columnspan=2, sticky=(tk.W, tk.E, tk.N, tk.S), pady=10)
        
        # ID
        ttk.Label(info_frame, text="ID:").grid(row=0, column=0, sticky=tk.W)
        self.id_var = tk.StringVar()
        self.id_entry = ttk.Entry(info_frame, textvariable=self.id_var, state='readonly')
        self.id_entry.grid(row=0, column=1, sticky=(tk.W, tk.E), pady=2)
        
        # Label
        ttk.Label(info_frame, text="Label:").grid(row=1, column=0, sticky=tk.W)
        self.label_var = tk.StringVar()
        self.label_entry = ttk.Entry(info_frame, textvariable=self.label_var)
        self.label_entry.grid(row=1, column=1, sticky=(tk.W, tk.E), pady=2)
        
        # Details
        ttk.Label(info_frame, text="Details:").grid(row=2, column=0, sticky=tk.W)
        self.details_text = tk.Text(info_frame, height=8, width=80)
        self.details_text.grid(row=2, column=1, sticky=(tk.W, tk.E), pady=2)
        
        # Configure column weights for info_frame to make details expand
        info_frame.grid_columnconfigure(1, weight=1)
        
        # Save button
        ttk.Button(info_frame, text="Save Changes", command=self.save_changes).grid(row=3, column=0, columnspan=2, pady=10)
        
        # Configure grid weights for top frame
        self.top_frame.grid_columnconfigure(1, weight=1)

    def setup_bottom_panel(self):
        """Setup the bottom panel with evidence management"""
        # Evidence frame
        evidence_frame = ttk.LabelFrame(self.bottom_frame, text="Evidence", padding="5")
        evidence_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        self.bottom_frame.grid_rowconfigure(0, weight=1)
        self.bottom_frame.grid_columnconfigure(0, weight=1)
        
        # Create canvas and scrollbar for evidence
        self.evidence_canvas = tk.Canvas(evidence_frame)
        scrollbar = ttk.Scrollbar(evidence_frame, orient="vertical", command=self.evidence_canvas.yview)
        
        # Configure canvas
        self.evidence_canvas.configure(yscrollcommand=scrollbar.set)
        
        # Create frame inside canvas for evidence items
        self.evidence_list_frame = ttk.Frame(self.evidence_canvas)
        
        # Pack scrollbar and canvas
        scrollbar.pack(side="right", fill="y")
        self.evidence_canvas.pack(side="left", fill="both", expand=True)
        
        # Create window in canvas
        self.canvas_frame = self.evidence_canvas.create_window((0,0), window=self.evidence_list_frame, anchor="nw")
        
        # Configure canvas scrolling
        self.evidence_list_frame.bind("<Configure>", self.on_frame_configure)
        self.evidence_canvas.bind("<Configure>", self.on_canvas_configure)
        
        # Buttons frame
        button_frame = ttk.Frame(evidence_frame)
        button_frame.pack(side="bottom", fill="x", pady=10)
        
        ttk.Button(button_frame, text="Add Evidence", command=self.add_evidence).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="Remove Selected", command=self.remove_evidence).pack(side=tk.LEFT, padx=5)

    def on_frame_configure(self, event=None):
        """Reset the scroll region to encompass the inner frame"""
        self.evidence_canvas.configure(scrollregion=self.evidence_canvas.bbox("all"))

    def on_canvas_configure(self, event):
        """When canvas is resized, resize the inner frame to match"""
        width = event.width
        self.evidence_canvas.itemconfig(self.canvas_frame, width=width)

    def refresh_data(self):
        """Refresh the data in the UI"""
        if self.type_var.get():
            items = self.data_manager.get_items(self.type_var.get().lower())
            self.item_combo['values'] = [f"{item['ID']} - {item['Label']}" for item in items]

    def on_type_selected(self, event):
        """Handle type selection"""
        self.refresh_data()
        self.clear_item_info()

    def on_item_selected(self, event):
        """Handle item selection"""
        if not self.item_var.get():
            return
            
        item_id = self.item_var.get().split(' - ')[0]
        self.current_type = self.type_var.get().lower()
        self.current_item = self.data_manager.get_item(item_id, self.current_type)
        
        if self.current_item:
            # Update basic info
            self.id_var.set(self.current_item['ID'])
            self.label_var.set(self.current_item['Label'])
            self.details_text.delete('1.0', tk.END)
            self.details_text.insert('1.0', self.current_item.get('Details', ''))
            
            # Update evidence list
            self.refresh_evidence_list()

    def refresh_evidence_list(self):
        """Refresh the evidence list with images and source links"""
        # Clear existing evidence items and image references
        for widget in self.evidence_list_frame.winfo_children():
            widget.destroy()
        self.image_refs.clear()
            
        if not self.current_item:
            return
            
        evidence_data = []
        if self.current_item.get('EvidenceData'):
            try:
                evidence_data = json.loads(self.current_item['EvidenceData'])
            except json.JSONDecodeError:
                evidence_data = []
                
        # Create evidence items
        for idx, evidence in enumerate(evidence_data):
            # Create frame for this evidence item
            item_frame = ttk.Frame(self.evidence_list_frame)
            item_frame.pack(fill=tk.X, padx=5, pady=10)
            
            # Selection checkbox (top right)
            var = tk.BooleanVar()
            check = ttk.Checkbutton(item_frame, variable=var)
            check.pack(side=tk.TOP, anchor=tk.E)
            
            # Store reference to checkbox variable
            item_frame.evidence_idx = idx
            item_frame.selected = var
            
            # Load and display image using local path
            image_path = evidence.get('localPath')
            if not image_path:  # Fall back to old path format for compatibility
                image_path = evidence.get('evidenceUrl', '')
                if image_path.startswith('/'):
                    image_path = image_path.lstrip('/')
                image_path = Path(image_path)

            if image_path and os.path.exists(image_path):
                try:
                    # Open and resize image
                    img = Image.open(image_path)
                    
                    # Calculate new size maintaining aspect ratio
                    display_width = 600  # Reduced max width for better display
                    display_height = 400  # Reduced max height for better display
                    
                    # Calculate resize ratio
                    ratio = min(display_width/img.width, display_height/img.height)
                    new_size = (int(img.width * ratio), int(img.height * ratio))
                    img = img.resize(new_size, Image.Resampling.LANCZOS)
                    
                    # Convert to PhotoImage
                    photo = ImageTk.PhotoImage(img)
                    self.image_refs[idx] = photo  # Keep reference
                    
                    # Create and pack label with image
                    img_label = ttk.Label(item_frame, image=photo)
                    img_label.pack(pady=5)
                    
                    # Add source link if available
                    if evidence.get('sourceUrl'):
                        source_label = evidence.get('sourceLabel', 'Source')
                        source_link = ttk.Label(item_frame, text=source_label, 
                                              foreground="blue", cursor="hand2")
                        source_link.pack(pady=5)
                        source_link.bind("<Button-1>", 
                                       lambda e, url=evidence['sourceUrl']: webbrowser.open(url))
                    
                except Exception as e:
                    print(f"Error loading image {image_path}: {e}")
                    ttk.Label(item_frame, text=f"Error loading image: {e}").pack()
            else:
                ttk.Label(item_frame, text=f"Image not found: {image_path}").pack()
            
            # Add separator
            ttk.Separator(self.evidence_list_frame, orient='horizontal').pack(fill=tk.X, pady=5)

    def add_evidence(self):
        """Add new evidence"""
        if not self.current_item:
            messagebox.showwarning("Warning", "Please select an item first")
            return
            
        file_path = filedialog.askopenfilename(
            title="Select Evidence Image",
            filetypes=[("Image files", "*.png *.jpg *.jpeg *.gif *.bmp")]
        )
        
        if not file_path:
            return
            
        # Get source information
        dialog = SourceDialog(self.root)
        if dialog.result:
            source_url, source_label = dialog.result
            
            # Add evidence
            success = self.data_manager.add_evidence(
                self.current_item['ID'],
                self.current_type,
                file_path,
                source_url,
                source_label
            )
            
            if success:
                self.refresh_data()
                self.on_item_selected(None)
                messagebox.showinfo("Success", "Evidence added successfully")
            else:
                messagebox.showerror("Error", "Failed to add evidence")

    def remove_evidence(self):
        """Remove selected evidence items"""
        to_remove = []
        
        # Collect selected evidence indices
        for frame in self.evidence_list_frame.winfo_children():
            if hasattr(frame, 'selected') and frame.selected.get():
                to_remove.append(frame.evidence_idx)
                
        if not to_remove:
            messagebox.showwarning("Warning", "Please select evidence to remove")
            return
            
        if messagebox.askyesno("Confirm", f"Are you sure you want to remove {len(to_remove)} evidence item(s)?"):
            # Remove in reverse order to maintain correct indices
            for idx in sorted(to_remove, reverse=True):
                if self.data_manager.remove_evidence(self.current_item['ID'], self.current_type, idx):
                    continue
                else:
                    messagebox.showerror("Error", f"Failed to remove evidence {idx + 1}")
                    
            self.refresh_data()
            self.on_item_selected(None)
            messagebox.showinfo("Success", "Evidence removed successfully")

    def save_changes(self):
        """Save changes to basic information"""
        if not self.current_item:
            return
            
        self.current_item['Label'] = self.label_var.get()
        self.current_item['Details'] = self.details_text.get('1.0', tk.END).strip()
        
        if self.data_manager.update_item(self.current_item, self.current_type):
            messagebox.showinfo("Success", "Changes saved successfully")
            self.refresh_data()
        else:
            messagebox.showerror("Error", "Failed to save changes")

    def clear_item_info(self):
        """Clear item information"""
        self.id_var.set('')
        self.label_var.set('')
        self.details_text.delete('1.0', tk.END)
        self.evidence_list_frame.winfo_children()
        self.current_item = None

class DataManager:
    def __init__(self):
        self.public_dir = Path('public')
        self.public_dir.mkdir(exist_ok=True)
        
        self.images_dir = self.public_dir / IMAGES_SUBDIR
        self.images_dir.mkdir(exist_ok=True)
        
        self.nodes_csv = 'Nodes.csv'
        self.edges_csv = 'Edges.csv'

    def get_items(self, item_type):
        """Get all items of specified type"""
        csv_file = self.nodes_csv if item_type == 'node' else self.edges_csv
        items = []
        
        try:
            with open(csv_file, 'r', newline='', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                items = list(reader)
                
                # Ensure consistent evidence data format
                for item in items:
                    if not item.get('EvidenceData'):
                        item['EvidenceData'] = '[]'
                    try:
                        # Validate JSON format and normalize paths
                        evidence = json.loads(item['EvidenceData'])
                        if not isinstance(evidence, list):
                            item['EvidenceData'] = '[]'
                        else:
                            # Ensure all evidence uses forward slashes
                            for e in evidence:
                                if 'localPath' in e:
                                    e['localPath'] = e['localPath'].replace('\\', '/')
                            item['EvidenceData'] = json.dumps(evidence)
                    except json.JSONDecodeError:
                        item['EvidenceData'] = '[]'
                        
        except Exception as e:
            print(f"Error reading {csv_file}: {e}")
            
        return items

    def get_item(self, item_id, item_type):
        """Get specific item by ID and type"""
        items = self.get_items(item_type)
        for item in items:
            if item['ID'] == item_id:
                return item
        return None

    def update_item(self, item, item_type):
        """Update item basic information"""
        csv_file = self.nodes_csv if item_type == 'node' else self.edges_csv
        items = self.get_items(item_type)
        
        updated = False
        for idx, existing_item in enumerate(items):
            if existing_item['ID'] == item['ID']:
                # Ensure evidence data is properly formatted before saving
                if not item.get('EvidenceData'):
                    item['EvidenceData'] = '[]'
                try:
                    # Validate JSON format
                    evidence = json.loads(item['EvidenceData'])
                    if not isinstance(evidence, list):
                        item['EvidenceData'] = '[]'
                except json.JSONDecodeError:
                    item['EvidenceData'] = '[]'
                    
                items[idx] = item
                updated = True
                break
                
        if updated:
            try:
                with open(csv_file, 'w', newline='', encoding='utf-8') as f:
                    writer = csv.DictWriter(f, fieldnames=items[0].keys())
                    writer.writeheader()
                    writer.writerows(items)
                return True
            except Exception as e:
                print(f"Error updating {csv_file}: {e}")
                
        return False

    def add_evidence(self, item_id, item_type, image_path, source_url=None, source_label=None):
        """Add evidence to an item"""
        if not os.path.exists(image_path):
            return False

        # Generate unique filename and copy image
        image_ext = Path(image_path).suffix
        new_filename = f"{uuid.uuid4()}{image_ext}"
        new_image_path = self.images_dir / new_filename

        try:
            shutil.copy2(image_path, new_image_path)
        except Exception as e:
            print(f"Error copying image: {e}")
            return False

        # Store both the web URL and file path - use forward slashes for consistency
        evidence_data = {
            "evidenceUrl": f"/public/{IMAGES_SUBDIR}/{new_filename}",  # Web URL path
            "localPath": str(new_image_path).replace('\\', '/'),  # Local file path with forward slashes
            "sourceUrl": source_url if source_url else "",
            "sourceLabel": source_label if source_label else ""
        }

        # Update item
        item = self.get_item(item_id, item_type)
        if not item:
            return False

        try:
            existing_evidence = json.loads(item.get('EvidenceData', '[]'))
            if not isinstance(existing_evidence, list):
                existing_evidence = []
            
            # Ensure all existing evidence uses forward slashes
            for evidence in existing_evidence:
                if 'localPath' in evidence:
                    evidence['localPath'] = evidence['localPath'].replace('\\', '/')
                
        except json.JSONDecodeError:
            existing_evidence = []

        existing_evidence.append(evidence_data)
        item['EvidenceData'] = json.dumps(existing_evidence)

        return self.update_item(item, item_type)

    def remove_evidence(self, item_id, item_type, evidence_index):
        """Remove evidence from an item"""
        item = self.get_item(item_id, item_type)
        if not item:
            return False

        try:
            evidence_data = json.loads(item.get('EvidenceData', '[]'))
            if not isinstance(evidence_data, list):
                evidence_data = []

            if 0 <= evidence_index < len(evidence_data):
                # Remove image file if it exists
                image_path = evidence_data[evidence_index].get('localPath', '')
                if image_path:
                    try:
                        os.remove(Path(image_path))
                    except Exception as e:
                        print(f"Error removing image file: {e}")

                # Remove evidence from list
                evidence_data.pop(evidence_index)
                item['EvidenceData'] = json.dumps(evidence_data)
                return self.update_item(item, item_type)

        except Exception as e:
            print(f"Error removing evidence: {e}")

        return False

class SourceDialog:
    def __init__(self, parent):
        self.result = None
        
        # Create dialog
        self.dialog = tk.Toplevel(parent)
        self.dialog.title("Add Source Information")
        self.dialog.transient(parent)
        self.dialog.grab_set()
        
        # Source URL
        ttk.Label(self.dialog, text="Source URL:").grid(row=0, column=0, pady=5, padx=5)
        self.url_var = tk.StringVar()
        ttk.Entry(self.dialog, textvariable=self.url_var, width=40).grid(row=0, column=1, pady=5, padx=5)
        
        # Source Label
        ttk.Label(self.dialog, text="Source Label:").grid(row=1, column=0, pady=5, padx=5)
        self.label_var = tk.StringVar()
        ttk.Entry(self.dialog, textvariable=self.label_var, width=40).grid(row=1, column=1, pady=5, padx=5)
        
        # Buttons
        button_frame = ttk.Frame(self.dialog)
        button_frame.grid(row=2, column=0, columnspan=2, pady=10)
        
        ttk.Button(button_frame, text="OK", command=self.ok).grid(row=0, column=0, padx=5)
        ttk.Button(button_frame, text="Cancel", command=self.cancel).grid(row=0, column=1, padx=5)
        
        # Center dialog
        self.dialog.geometry("+%d+%d" % (parent.winfo_rootx() + 50,
                                        parent.winfo_rooty() + 50))
        
        self.dialog.wait_window()

    def ok(self):
        self.result = (self.url_var.get(), self.label_var.get())
        self.dialog.destroy()

    def cancel(self):
        self.dialog.destroy()

def main():
    root = tk.Tk()
    app = EvidenceManagerGUI(root)
    root.mainloop()

if __name__ == "__main__":
    main() 