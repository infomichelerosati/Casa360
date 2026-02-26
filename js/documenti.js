// js/documenti.js

let docCropper = null;
let docCurrentFile = null;
let docOriginalFileName = '';
let docOriginalFileType = '';
let docCategories = ['Tutti', 'Identità', 'Salute', 'Casa', 'Veicoli', 'Scuola', 'Altro'];
let currentDocCategory = 'Tutti';
let allDocuments = [];
let currentDocViewing = null;

async function initDocumenti() {
    console.log("Inizializzazione Modulo Documenti...");

    // Se Cropper non è caricato (magari lento CDN), aspettiamo o diamo un warning
    if (typeof Cropper === 'undefined') {
        console.warn("Cropper.js non ancora caricato. Riprovo tra poco...");
        setTimeout(initDocumenti, 500);
        return;
    }

    setupDocModalEvents();
    setupDocViewerEvents();
    setupCategoryFilters();

    await loadDocuments();
}

function setupCategoryFilters() {
    const container = document.getElementById('doc-categories-container');
    const btns = document.querySelectorAll('.doc-cat-btn');

    btns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Update UI
            btns.forEach(b => {
                b.classList.remove('bg-darkblue-accent', 'text-white');
                b.classList.add('bg-darkblue-base', 'text-darkblue-icon');
            });
            const t = e.target;
            t.classList.remove('bg-darkblue-base', 'text-darkblue-icon');
            t.classList.add('bg-darkblue-accent', 'text-white');

            // Filter Data
            currentDocCategory = t.dataset.cat;
            renderDocumentsGrid();
        });
    });

    // Desktop drag-to-scroll
    if (container && container.parentElement) {
        const wrapper = container.parentElement;
        let isDown = false;
        let startX;
        let scrollLeft;

        wrapper.classList.add('cursor-grab');

        wrapper.addEventListener('mousedown', (e) => {
            isDown = true;
            wrapper.classList.add('cursor-grabbing');
            wrapper.classList.remove('cursor-grab');
            startX = e.pageX - wrapper.offsetLeft;
            scrollLeft = wrapper.scrollLeft;
        });

        wrapper.addEventListener('mouseleave', () => {
            isDown = false;
            wrapper.classList.remove('cursor-grabbing');
            wrapper.classList.add('cursor-grab');
        });

        wrapper.addEventListener('mouseup', () => {
            isDown = false;
            wrapper.classList.remove('cursor-grabbing');
            wrapper.classList.add('cursor-grab');
        });

        wrapper.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - wrapper.offsetLeft;
            const walk = (x - startX) * 2; // scroll speed multiplier
            wrapper.scrollLeft = scrollLeft - walk;
        });
    }
}

// ==========================================
// UPLOAD & CROPPER MODAL LOGIC
// ==========================================
function setupDocModalEvents() {
    const modal = document.getElementById('modal-doc-upload');
    const content = document.getElementById('modal-content-doc-upload');
    const step1 = document.getElementById('doc-upload-step-1');
    const step2 = document.getElementById('doc-upload-step-2');

    const openModal = () => {
        document.getElementById('form-doc-meta').reset();
        document.getElementById('doc-file-input').value = '';
        resetFileInfoUI();
        step1.classList.remove('hidden');
        step2.classList.add('hidden');

        modal.classList.remove('opacity-0', 'pointer-events-none');
        content.classList.remove('translate-y-full');
    };

    const closeModal = () => {
        modal.classList.add('opacity-0', 'pointer-events-none');
        content.classList.add('translate-y-full');
        if (docCropper) {
            docCropper.destroy();
            docCropper = null;
        }
    };

    document.getElementById('btn-add-document').addEventListener('click', openModal);
    document.getElementById('btn-close-doc-upload').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    // File Selection
    const fileInput = document.getElementById('doc-file-input');
    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            docCurrentFile = file;
            docOriginalFileName = file.name;
            docOriginalFileType = file.type;

            // Update UI with file info
            document.getElementById('doc-file-info').classList.remove('hidden');
            document.getElementById('doc-file-name').textContent = file.name;
            document.getElementById('doc-file-size').textContent = (file.size / (1024 * 1024)).toFixed(2) + ' MB';

            const isPdf = file.type === 'application/pdf';
            document.getElementById('doc-file-icon').className = isPdf ? 'fa-solid fa-file-pdf text-red-500' : 'fa-solid fa-file-image text-blue-500';

            // Enable Next Button
            const btnNext = document.getElementById('btn-next-step');
            btnNext.disabled = false;
            btnNext.classList.remove('opacity-50', 'cursor-not-allowed');

            if (isPdf) {
                btnNext.innerHTML = `Carica PDF <i class="fa-solid fa-upload ml-2 text-sm"></i>`;
            } else {
                btnNext.innerHTML = `Procedi al Ritaglio <i class="fa-solid fa-crop ml-2 text-sm"></i>`;
            }
        }
    });

    document.getElementById('btn-reset-file').addEventListener('click', () => {
        fileInput.value = '';
        resetFileInfoUI();
    });

    // Next Step / Submit Form
    document.getElementById('btn-next-step').addEventListener('click', () => {
        // Validate form manually since we avoid default submit
        const form = document.getElementById('form-doc-meta');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        if (docOriginalFileType === 'application/pdf') {
            // PDF skip cropper
            handleUploadFinal(docCurrentFile);
        } else {
            // Image goes to cropper
            initCropperStep();
        }
    });

    // Back from cropper
    document.getElementById('btn-back-step').addEventListener('click', () => {
        step2.classList.add('hidden');
        step1.classList.remove('hidden');
        if (docCropper) docCropper.destroy();
    });

    document.getElementById('btn-crop-cancel').addEventListener('click', () => {
        step2.classList.add('hidden');
        step1.classList.remove('hidden');
        if (docCropper) docCropper.destroy();
    });

    // Final Crop & Save
    document.getElementById('btn-crop-save').addEventListener('click', async () => {
        if (!docCropper) return;

        // UI Loading
        const btn = document.getElementById('btn-crop-save');
        const spinner = document.getElementById('btn-crop-save-spinner');
        btn.disabled = true;
        spinner.classList.remove('hidden');

        try {
            // Get cropped canvas
            const canvas = docCropper.getCroppedCanvas({
                maxWidth: 1600, // Max resolution to avoid memory issues
                maxHeight: 1600
            });

            // Compress to JPEG Blob
            canvas.toBlob(async (blob) => {
                if (!blob) throw new Error("Errore generazione immagine");

                // Crea un nuovo file dal blob
                const newFileName = 'doc_' + Date.now() + '.jpg';
                const croppedFile = new File([blob], newFileName, { type: 'image/jpeg' });

                await handleUploadFinal(croppedFile);

            }, 'image/jpeg', 0.8); // 80% quality compression

        } catch (err) {
            console.error(err);
            alert("Errore durante il ritaglio dell'immagine.");
            btn.disabled = false;
            spinner.classList.add('hidden');
        }
    });
}

function resetFileInfoUI() {
    docCurrentFile = null;
    document.getElementById('doc-file-info').classList.add('hidden');
    const btnNext = document.getElementById('btn-next-step');
    btnNext.disabled = true;
    btnNext.classList.add('opacity-50', 'cursor-not-allowed');
    btnNext.innerHTML = `Procedi al Ritaglio <i class="fa-solid fa-arrow-right ml-2 text-sm"></i>`;
}

function initCropperStep() {
    const step1 = document.getElementById('doc-upload-step-1');
    const step2 = document.getElementById('doc-upload-step-2');

    step1.classList.add('hidden');
    step2.classList.remove('hidden');

    const imageElement = document.getElementById('cropper-image');

    // Load local file to image src
    const reader = new FileReader();
    reader.onload = (e) => {
        imageElement.src = e.target.result;

        // Wait for image load then init cropper
        imageElement.onload = () => {
            if (docCropper) docCropper.destroy();
            docCropper = new Cropper(imageElement, {
                viewMode: 1, // Restrict the crop box not to exceed the size of the canvas
                dragMode: 'move', // Default to moving image
                autoCropArea: 0.9,
                restore: false,
                guides: true,
                center: true,
                highlight: false,
                cropBoxMovable: true,
                cropBoxResizable: true,
                toggleDragModeOnDblclick: false,
            });
        };
    };
    reader.readAsDataURL(docCurrentFile);
}

async function handleUploadFinal(fileToUpload) {
    // Reset/Re-grab UI in case spinner wasn't handled (e.g. PDF bypass)
    let spinner = document.getElementById('btn-crop-save-spinner');
    let btn = document.getElementById('btn-crop-save');
    if (docOriginalFileType === 'application/pdf') {
        btn = document.getElementById('btn-next-step');
        btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Caricamento...`;
        btn.disabled = true;
    }

    try {
        const familyId = await window.getUserFamilyId();
        const user = await window.getLoggedUser();

        // 1. Upload to Supabase Storage
        // Generate safe random path: familyId / timestamp_filename
        const fileExt = fileToUpload.name.split('.').pop();
        const safeName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${familyId}/${safeName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('documents')
            .upload(filePath, fileToUpload, {
                cacheControl: '31536000',
                upsert: false
            });

        if (uploadError) throw uploadError;

        // 2. Insert Metadata to family_documents table
        const title = document.getElementById('doc-title').value;
        const category = document.getElementById('doc-category').value;
        const expiry = document.getElementById('doc-expiry').value || null;
        const desc = document.getElementById('doc-desc').value;

        const { error: dbError } = await supabase
            .from('family_documents')
            .insert([{
                family_id: familyId,
                uploaded_by: user.id,
                title: title,
                description: desc,
                category: category,
                expiry_date: expiry,
                file_url: filePath,
                file_type: fileToUpload.type,
                file_size: fileToUpload.size
            }]);

        if (dbError) throw dbError;

        // Success!
        const modal = document.getElementById('modal-doc-upload');
        const content = document.getElementById('modal-content-doc-upload');
        modal.classList.add('opacity-0', 'pointer-events-none');
        content.classList.add('translate-y-full');
        if (docCropper) docCropper.destroy();

        await loadDocuments();

    } catch (err) {
        console.error("Upload Error:", err);
        alert("Errore durante il caricamento del documento. Riprova.");
    } finally {
        if (btn) btn.disabled = false;
        if (spinner) spinner.classList.add('hidden');
        if (docOriginalFileType === 'application/pdf' && btn) {
            btn.innerHTML = `Carica PDF <i class="fa-solid fa-upload ml-2 text-sm"></i>`;
        }
    }
}

// ==========================================
// FETCH & RENDER
// ==========================================
async function loadDocuments() {
    const grid = document.getElementById('documents-grid');
    grid.innerHTML = `<div class="col-span-2 text-center text-darkblue-icon/50 pt-8"><i class="fa-solid fa-circle-notch fa-spin text-3xl"></i></div>`;

    try {
        const familyId = await window.getUserFamilyId();
        const { data, error } = await supabase
            .from('family_documents')
            .select('*, family_members(name)')
            .eq('family_id', familyId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        allDocuments = data || [];
        renderDocumentsGrid();

    } catch (err) {
        console.error("Errore fetch download", err);
        grid.innerHTML = `<div class="col-span-2 text-center text-red-500 text-sm py-4">Errore di caricamento.</div>`;
    }
}

async function getPresignedUrl(filePath) {
    // Generate an URL valid for 1 hour (3600s)
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(filePath, 3600);
    if (error) {
        console.error("Presigned URL Error:", error);
        return null;
    }
    return data.signedUrl;
}

async function renderDocumentsGrid() {
    const grid = document.getElementById('documents-grid');
    grid.innerHTML = '';

    const filteredDocs = currentDocCategory === 'Tutti'
        ? allDocuments
        : allDocuments.filter(d => d.category === currentDocCategory);

    if (filteredDocs.length === 0) {
        grid.innerHTML = `
            <div class="col-span-2 flex flex-col items-center justify-center pt-12 opacity-50">
                <i class="fa-solid fa-folder-open text-6xl text-darkblue-icon mb-4"></i>
                <p class="text-sm font-bold text-darkblue-icon">Nessun documento trovato.</p>
            </div>
        `;
        return;
    }

    for (const doc of filteredDocs) {
        const isPdf = doc.file_type === 'application/pdf';

        const card = document.createElement('div');
        card.className = 'clay-card rounded-3xl p-3 flex flex-col gap-2 relative overflow-hidden group cursor-pointer active:scale-95 transition-transform';

        let visualArea = '';
        if (isPdf) {
            visualArea = `
                <div class="w-full aspect-square bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 shrink-0">
                    <i class="fa-solid fa-file-pdf text-4xl"></i>
                </div>
            `;
        } else {
            // we should ideally use a thumbnail, but for now we get a signed url
            // To make it faster, we could load signed urls asynchronously after rendering card shell
            visualArea = `
                <div class="w-full aspect-square bg-darkblue-base rounded-2xl flex items-center justify-center shrink-0 overflow-hidden relative">
                    <i class="fa-solid fa-circle-notch fa-spin text-darkblue-icon absolute z-0"></i>
                    <img data-filepath="${doc.file_url}" class="lazy-doc-img w-full h-full object-cover relative z-10 opacity-0 transition-opacity duration-300">
                </div>
            `;
        }

        let expiryHtml = '';
        if (doc.expiry_date) {
            const expDate = new Date(doc.expiry_date);
            const now = new Date();
            const diffDays = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));

            let badgeColor = 'bg-darkblue-base text-darkblue-icon'; // safe
            if (diffDays < 0) badgeColor = 'bg-red-500 text-white shadow-md shadow-red-500/50'; // expired
            else if (diffDays <= 30) badgeColor = 'bg-orange-500 text-white shadow-md shadow-orange-500/50'; // expiring soon

            expiryHtml = `
                <div class="absolute top-4 left-4 ${badgeColor} text-[9px] font-bold px-2 py-0.5 rounded-full z-20 flex items-center gap-1">
                    <i class="fa-solid fa-clock"></i> ${expDate.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' })}
                </div>
            `;
        }

        let uploaderName = doc.family_members ? doc.family_members.name.charAt(0).toUpperCase() : '?';

        card.innerHTML = `
            ${expiryHtml}
            <div class="absolute top-4 right-4 w-6 h-6 rounded-full bg-darkblue-base/80 backdrop-blur-sm border border-white/10 text-[10px] font-bold text-white flex items-center justify-center z-20">
                ${uploaderName}
            </div>
            
            ${visualArea}
            
            <div class="mt-1 pb-1 px-1">
                <span class="text-[9px] uppercase font-bold text-darkblue-accent tracking-wider">${doc.category}</span>
                <h3 class="text-xs font-bold text-darkblue-heading truncate mt-0.5">${doc.title}</h3>
            </div>
        `;

        card.addEventListener('click', () => openDocViewer(doc));
        grid.appendChild(card);
    }

    // Lazy load images
    const images = document.querySelectorAll('.lazy-doc-img');
    for (const img of images) {
        const path = img.dataset.filepath;
        getPresignedUrl(path).then(url => {
            if (url) {
                img.src = url;
                img.onload = () => img.classList.remove('opacity-0');
            }
        });
    }
}

// ==========================================
// DOCUMENT VIEWER & SHARE
// ==========================================
function setupDocViewerEvents() {
    const modal = document.getElementById('modal-doc-viewer');
    const btnClose = document.getElementById('btn-close-viewer');

    const closeModal = () => {
        modal.classList.add('opacity-0', 'pointer-events-none');
        document.getElementById('viewer-image').src = ''; // free memory
        currentDocViewing = null;
    };

    btnClose.addEventListener('click', closeModal);

    document.getElementById('btn-delete-doc').addEventListener('click', async () => {
        if (!currentDocViewing) return;
        window.showConfirmModal("Elimina Documento", "Sei sicuro di voler cancellare questo documento in modo permanente?", async () => {
            try {
                // Remove from Storage
                await supabase.storage.from('documents').remove([currentDocViewing.file_url]);
                // Remove from DB
                await supabase.from('family_documents').delete().eq('id', currentDocViewing.id);

                closeModal();
                loadDocuments();
            } catch (err) {
                console.error("Delete err:", err);
                alert("Errore eliminazione");
            }
        });
    });

    document.getElementById('btn-share-doc').addEventListener('click', handleWebShare);
}

async function openDocViewer(doc) {
    currentDocViewing = doc;
    const modal = document.getElementById('modal-doc-viewer');

    // UI Resets
    const imgEl = document.getElementById('viewer-image');
    const pdfEl = document.getElementById('viewer-pdf');
    const spinner = document.getElementById('viewer-spinner');
    const btnDownload = document.getElementById('btn-download-doc');
    const btnOpenPdf = document.getElementById('btn-open-pdf');
    const btnShare = document.getElementById('btn-share-doc');

    imgEl.classList.add('hidden');
    pdfEl.classList.add('hidden');
    spinner.classList.remove('hidden');

    // Info fills
    document.getElementById('viewer-doc-title').textContent = doc.title;
    document.getElementById('viewer-cat-badge').textContent = doc.category;
    document.getElementById('viewer-size').textContent = (doc.file_size / (1024 * 1024)).toFixed(2) + ' MB';

    const d = new Date(doc.created_at);
    document.getElementById('viewer-date').textContent = d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });

    if (doc.description) {
        document.getElementById('viewer-doc-desc').textContent = doc.description;
        document.getElementById('viewer-doc-desc').classList.remove('hidden');
    } else {
        document.getElementById('viewer-doc-desc').classList.add('hidden');
    }

    if (doc.expiry_date) {
        document.getElementById('viewer-expiry-badge').classList.remove('hidden');
        document.getElementById('viewer-expiry-badge').classList.add('inline-block'); // fix flex inline issue
        const ed = new Date(doc.expiry_date);
        document.getElementById('viewer-expiry-date').textContent = "Scade " + ed.toLocaleDateString('it-IT');
    } else {
        document.getElementById('viewer-expiry-badge').classList.add('hidden');
        document.getElementById('viewer-expiry-badge').classList.remove('inline-block');
    }

    // Share API Support check
    if (navigator.share) {
        btnShare.classList.remove('hidden');
    } else {
        btnShare.classList.add('hidden');
    }

    // Modal show
    modal.classList.remove('opacity-0', 'pointer-events-none');

    // Fetch Signed URL
    const url = await getPresignedUrl(doc.file_url);
    if (!url) {
        spinner.innerHTML = '<span class="text-red-500">Errore caricamento</span>';
        return;
    }

    btnDownload.href = url;

    if (doc.file_type === 'application/pdf') {
        spinner.classList.add('hidden');
        pdfEl.classList.remove('hidden');
        pdfEl.classList.add('flex');
        btnOpenPdf.href = url;
    } else {
        imgEl.onload = () => {
            spinner.classList.add('hidden');
            imgEl.classList.remove('hidden');
        };
        imgEl.src = url;
    }
}

async function handleWebShare() {
    if (!currentDocViewing || !navigator.share) return;

    const btn = document.getElementById('btn-share-doc');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
    btn.disabled = true;

    try {
        const url = await getPresignedUrl(currentDocViewing.file_url);

        // Fetch the file as a Blob to share it as a file directly
        const response = await fetch(url);
        const blob = await response.blob();

        // Costruire un File object
        const ext = currentDocViewing.file_type === 'application/pdf' ? '.pdf' : '.jpg';
        const file = new File([blob], currentDocViewing.title + ext, { type: currentDocViewing.file_type });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                title: currentDocViewing.title,
                text: 'Guarda questo documento: ' + currentDocViewing.title,
                files: [file]
            });
        } else {
            // Fallback: share the link
            await navigator.share({
                title: currentDocViewing.title,
                url: url
            });
        }
    } catch (err) {
        console.log("Condivisione annullata o fallita", err);
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
}
