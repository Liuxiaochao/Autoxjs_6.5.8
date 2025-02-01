package org.autojs.autoxjs.ui.main

import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentActivity
import androidx.viewpager2.adapter.FragmentStateAdapter
import org.autojs.autoxjs.ui.main.scripts.ScriptListFragment
import org.autojs.autoxjs.ui.main.task.TaskManagerFragmentKt
import org.autojs.autoxjs.ui.main.web.EditorAppManager

class ViewPager2Adapter(
    fragmentActivity: FragmentActivity,
    private val scriptListFragment: ScriptListFragment,
    private val taskManagerFragment: TaskManagerFragmentKt,
    private val webViewFragment: EditorAppManager
) : FragmentStateAdapter(fragmentActivity) {

    override fun createFragment(position: Int): Fragment {
        val fragment = when (position) {
            0 -> {
                scriptListFragment
            }
            1 -> {
                taskManagerFragment
            }
            else -> {
                webViewFragment
            }
        }
        return fragment
    }

    override fun getItemCount(): Int {
        return 3
    }
}